import { TFile, Vault } from "obsidian";
import { tool } from "ai";
import { DESCRIPTION } from "./write";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { WriteToolMessageCard } from "@/ui/components/agent-view/messages/message/write-tool-message-card";
import { MessageV2 } from "@/types";
import { diff_match_patch } from "diff-match-patch";

import { SnapshotLogic } from "@/logic/snapshot-logic";

export const toolName = "write"

const dmp = new diff_match_patch()

interface WriteResult {
  file_path: string
  old_content?: string
  new_content: string
  is_new_file: boolean
  diff: string
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

export const WriteTool = tool({
  title: toolName,
  description: DESCRIPTION,
  inputSchema: z.object({
    file_path: z.string().describe("要创建或覆盖的笔记路径（相对于 vault 根目录，例如：'项目/文档/README.md'）"),
    content: z.string().describe("要写入的笔记完整内容"),
  }),
  execute: async ({ file_path, content }, { toolCallId, experimental_context }) => {
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
      const exists = !!file

      let oldContent = ''
      if (exists) {
        try {
          oldContent = await vault.read(file)
        } catch (error) {
  				throw new Error(`Failed to read file: ${error instanceof Error ? error.message : "unknown error"}`)
        }
      }

      const diff = exists ? createDiff(oldContent, content) : ''

      let resolver: (value: "apply" | "reject") => void
      const waitForDecision = () => new Promise<"apply" | "reject">((resolve) => { resolver = resolve })
      const handleApply = () => { resolver("apply") }
      const handleReject = () => { resolver("reject") }

      const writeResult: WriteResult = {
        file_path: relativePath,
        old_content: exists ? oldContent : undefined,
        new_content: content,
        is_new_file: !exists,
        diff,
      }

      toolMessage.setChildren(render(writeResult, false, null, handleApply, handleReject))
      context.addMessage(toolMessage)

      const decision = await waitForDecision()

      let payloadError: any = null;
      let isCancelled = false;
      let snapshotId = "";

      if (decision === "apply") {
        try {
          snapshotId = await SnapshotLogic.getInstance().createSnapshot(relativePath);
          if (exists) {
            await vault.modify(file!, content)
          } else {
            const dirPath = relativePath.substring(0, relativePath.lastIndexOf('/'))
            if (dirPath && dirPath !== '.' && dirPath !== '') {
              const dirExists = await vault.adapter.exists(dirPath)
              if (!dirExists) {
                await vault.adapter.mkdir(dirPath)
              }
            }
            await vault.create(relativePath, content)
          }
        } catch (error) {
					payloadError = {
  					error: "File write failed",
  					details: error instanceof Error ? error.message : "unknown error",
  				};
        }
  		} else {
          isCancelled = true;
  				payloadError = {
  					cancelled: true,
  					message: "User rejected the file write",
  				};
  		}

      // Save the complete state for historical rendering
			const payload = {
				toolName,
				decision,
				writeResult,
				error: payloadError,
				isCancelled,
				snapshotId,
			};
			toolMessage.setContent(JSON.stringify(payload));

      toolMessage.setChildren(render(writeResult, true, decision, handleApply, handleReject))
      toolMessage.close()
      context.addMessage(toolMessage)

  			return JSON.stringify({
  				success: decision === "apply" ? "Write successful" : "User rejected",
  				file_path: relativePath,
  				is_new_file: !exists,
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
  writeResult: WriteResult,
  origin_answered_state: boolean,
  decision: "apply" | "reject" | null,
  onApply: () => void,
  onReject: () => void
): React.ReactNode {
  return (
    <WriteToolMessageCard
      writeResult={writeResult}
      origin_answered_state={origin_answered_state}
      decision={decision}
      onApply={onApply}
      onReject={onReject}
    />
  )
}
