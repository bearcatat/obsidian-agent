import { TFile } from "obsidian";
import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { FileEditToolMessageCard } from "@/ui/components/agent-view/messages/message/file-edit-tool-message-card";
import { FileEdit, FileReviewStatus, MessageV2 } from "@/types";
import { diff_match_patch } from "diff-match-patch";
import { FileReviewLogic } from "@/logic/file-review-logic";
import { fileMutex } from "./mutex";

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
	execute: async ({ file_path, old_string, new_string, replaceAll }, { toolCallId, experimental_context, abortSignal }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		
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

		const release = await fileMutex.acquire(relativePath);

		try {
			if (abortSignal?.aborted) {
				throw new Error("Tool execution was cancelled.")
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
			const toolMessage = ToolMessage.from(toolName, toolCallId ?? "")
			const reviewBase = await FileReviewLogic.getInstance().prepareReviewBase(relativePath, oldContent, false)

			const fileEdit: FileEdit = {
				id: toolCallId ?? "",
				file_path: relativePath,
				old_string,
				new_string,
				old_content: oldContent || undefined,
				new_content: newContent,
			}

			await vault.process(file!, () => newContent)

			const reviewEntry = FileReviewLogic.getInstance().registerAutoAppliedChange({
				...reviewBase,
				filePath: relativePath,
				headContent: newContent,
				toolCallId: toolCallId ?? "",
				messageId: toolMessage.id,
				toolName,
			})

			const payload = {
				toolName,
				fileEdit,
				snapshotId: reviewBase.baselineSnapshotId,
				reviewStatus: reviewEntry.status,
				isReverted: reviewEntry.isReverted,
			};
			toolMessage.setContent(JSON.stringify(payload));

			toolMessage.setChildren(render(fileEdit, false, reviewEntry.status, reviewEntry.isReverted))
			toolMessage.close()
			context.addMessage(toolMessage)

			return JSON.stringify({
				success: "Edit successful",
				file_path: relativePath,
				diff,
				review_status: reviewEntry.status,
			})
		} catch (error) {
			if (!abortSignal?.aborted && !(error instanceof Error && error.message === "Tool execution was cancelled.")) {
				const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
				context.addMessage(errorMessage)
			}
			throw error
		} finally {
			release();
		}
	}
})

function render(
	fileEdit: FileEdit,
	origin_answered_state: boolean,
	reviewStatus?: FileReviewStatus,
	isReverted?: boolean
): React.ReactNode {
	return (
		<FileEditToolMessageCard
			fileEdit={fileEdit}
			origin_answered_state={origin_answered_state}
			reviewStatus={reviewStatus}
			isReverted={isReverted}
		/>
	)
}
