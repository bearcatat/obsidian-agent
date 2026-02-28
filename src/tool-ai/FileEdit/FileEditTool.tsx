import { TFile, Vault } from "obsidian";
import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { FileEditToolMessageCard } from "@/ui/components/agent-view/messages/message/file-edit-tool-message-card";
import { FileEdit, MessageV2 } from "@/types";
import { diff_match_patch } from "diff-match-patch";

import { SnapshotLogic } from "@/logic/snapshot-logic";

export const toolName = "editFile"

const dmp = new diff_match_patch()

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function createDiff(oldText: string, newText: string): string {
  const diffs = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(diffs)
  
  let result = ''
  for (const [op, text] of diffs) {
    if (op === 0) {
      result += text
    } else if (op === -1) {
      const lines = text.split('\n')
      for (const line of lines) {
        result += `-${line}\n`
      }
    } else if (op === 1) {
      const lines = text.split('\n')
      for (const line of lines) {
        result += `+${line}\n`
      }
    }
  }
  return result.trim()
}

function findBestMatch(
  oldContent: string,
  old_string: string,
  replaceStr: string,
  replaceAll: boolean
): { matched: boolean; content: string; protected: boolean; message?: string } {
  const exactMatchCount = (oldContent.match(new RegExp(escapeRegExp(old_string), 'g')) || []).length
  if (exactMatchCount > 0) {
    if (exactMatchCount > 1 && !replaceAll) {
      return {
        matched: false,
        content: oldContent,
        protected: true,
        message: `old_string appears multiple times (${exactMatchCount} matches). Use replaceAll=true to replace all occurrences, or provide a more specific old_string that is unique in the file.`
      }
    }
    const newContent = replaceAll
      ? oldContent.split(old_string).join(replaceStr)
      : oldContent.replace(old_string, replaceStr)
    return {
      matched: true,
      content: newContent,
      protected: false
    }
  }

  const trimmedOld = normalizeWhitespace(old_string)
  if (trimmedOld) {
    const lines = oldContent.split('\n')
    const matchedIndices: number[] = []
    for (let i = 0; i < lines.length; i++) {
      if (normalizeWhitespace(lines[i]) === trimmedOld) {
        matchedIndices.push(i)
      }
    }
    if (matchedIndices.length > 0) {
      if (matchedIndices.length > 1 && !replaceAll) {
        return {
          matched: false,
          content: oldContent,
          protected: true,
          message: `old_string appears multiple times (${matchedIndices.length} matches). Use replaceAll=true to replace all occurrences, or provide a more specific old_string that is unique in the file.`
        }
      }
      const newLines = [...lines]
      newLines[matchedIndices[0]] = replaceStr
      return {
        matched: true,
        content: newLines.join('\n'),
        protected: false
      }
    }
  }

  return {
    matched: false,
    content: oldContent,
    protected: false
  }
}

export const FileEditTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		file_path: z.string().describe("要修改笔记的路径（相对于 vault 根目录，例如：'项目/文档/README.md'）"),
		old_string: z.string().describe("要替换的文本（在笔记中必须是唯一的）"),
		new_string: z.string().describe("用于替换 old_string 的编辑后文本"),
		replaceAll: z.boolean().optional().describe("是否替换所有匹配项（默认 false，仅替换第一个匹配）").default(false),
	}),
	execute: async ({ file_path, old_string, new_string, replaceAll }, { toolCallId, experimental_context }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		try {
			const toolMessage = ToolMessage.from(toolName, toolCallId)
			const app = getGlobalApp()
			const vault = app.vault

			let relativePath = file_path.replace(/\\/g, '/')

			if (relativePath.startsWith('/') || /^[A-Za-z]:/.test(relativePath)) {
				try {
					const vaultPath = (vault.adapter as any).basePath || ''
					if (vaultPath && (file_path.startsWith(vaultPath) || relativePath.startsWith(vaultPath.replace(/\\/g, '/')))) {
						relativePath = relativePath.replace(vaultPath.replace(/\\/g, '/'), '').replace(/^\/+/, '')
					} else if (relativePath.startsWith('/')) {
						relativePath = relativePath.replace(/^\/+/, '')
					}
				} catch (e) {
					relativePath = relativePath.replace(/^\/+/, '')
				}
			}

			const file = vault.getAbstractFileByPath(relativePath) as TFile | null

			if (!file) {
				throw new Error(`File does not exist: The file at path "${relativePath}" does not exist. Please use the write tool to create a new file.`)
			}

			let oldContent = ''
			let newContent = ''

			try {
				oldContent = await vault.read(file)
			} catch (error) {
				throw new Error(`Failed to read file: ${error instanceof Error ? error.message : "unknown error"}`)
			}

			const matchResult = findBestMatch(oldContent, old_string, new_string, replaceAll || false)

			if (!matchResult.matched) {
				if (matchResult.protected && matchResult.message) {
					throw new Error(matchResult.message)
				}
				throw new Error(`old_string mismatch: No matching old_string found in the file`)
			}

			newContent = matchResult.content

			const diff = createDiff(oldContent, newContent)

			let resolver: (value: "apply" | "reject") => void
			const waitForDecision = () => new Promise<"apply" | "reject">((resolve) => { resolver = resolve })
			const handleApply = () => { resolver("apply") }
			const handleReject = () => { resolver("reject") }

			const fileEdit: FileEdit = {
				id: toolCallId ?? "",
				file_path: relativePath,
				old_string,
				new_string,
				old_content: oldContent || undefined,
				new_content: newContent,
			}

			toolMessage.setChildren(render(fileEdit, false, null, handleApply, handleReject))
			context.addMessage(toolMessage)

			const decision = await waitForDecision()

			let payloadError: any = null;
			let isCancelled = false;
			let snapshotId = "";

			if (decision === "apply") {
				try {
					if (file) {
						snapshotId = await SnapshotLogic.getInstance().createSnapshot(relativePath);
					}
					await vault.process(file!, () => newContent)
				} catch (error) {
					payloadError = {
						error: "File operation failed",
						details: error instanceof Error ? error.message : "unknown error",
					};
				}
			} else {
				isCancelled = true;
				payloadError = {
					cancelled: true,
					message: "User rejected the file edit",
				};
			}

			// Save the complete state for historical rendering
			const payload = {
				toolName,
				decision,
				fileEdit,
				error: payloadError,
				isCancelled,
				snapshotId,
			};
			toolMessage.setContent(JSON.stringify(payload));

			toolMessage.setChildren(render(fileEdit, true, decision, handleApply, handleReject))
			toolMessage.close()
			context.addMessage(toolMessage)

			return JSON.stringify({
				success: decision === "apply" ? "Edit successful" : "User rejected",
				file_path: relativePath,
				diff,
			})
		} catch (error) {
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			context.addMessage(errorMessage)
			throw error
		}
	}
})

function render(
	fileEdit: FileEdit,
	origin_answered_state: boolean,
	decision: "apply" | "reject" | null,
	onApply: () => void,
	onReject: () => void
): React.ReactNode {
	return (
		<FileEditToolMessageCard
			fileEdit={fileEdit}
			origin_answered_state={origin_answered_state}
			decision={decision}
			onApply={onApply}
			onReject={onReject}
		/>
	)
}
