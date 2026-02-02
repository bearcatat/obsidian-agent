import { TFile, Vault } from "obsidian";
import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { FileEditToolMessageCard } from "@/ui/components/agent-view/messages/message/file-edit-tool-message-card";
import { FileEdit, MessageV2 } from "@/types";

export const toolName = "editFile"

export const FileEditTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		file_path: z.string().describe("要修改笔记的路径（相对于 vault 根目录，例如：'项目/文档/README.md'）"),
		old_string: z.string().describe("要替换的文本（在笔记中必须是唯一的，创建新笔记时为空）"),
		new_string: z.string().describe("用于替换 old_string 的编辑后文本"),
	}),
	execute: async ({ file_path, old_string, new_string }, { toolCallId, experimental_context }) => {
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

			const isNewFile = !old_string || old_string.trim() === ''
			const file = vault.getAbstractFileByPath(relativePath) as TFile | null

			let oldContent = ''
			let newContent = ''

			if (isNewFile) {
				newContent = new_string
			} else {
				if (!file) {
					throw new Error(`文件不存在: 路径 "${relativePath}" 对应的文件不存在`)
				}

				try {
					oldContent = await vault.read(file)
				} catch (error) {
					throw new Error(`读取文件失败: ${error instanceof Error ? error.message : "未知错误"}`)
				}

				const occurrences = (oldContent.match(new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
				if (occurrences === 0) {
					throw new Error(`old_string 不匹配: 在文件中找不到匹配的 old_string`)
				}
				if (occurrences > 1) {
					throw new Error(`old_string 不唯一: old_string 在文件中出现了 ${occurrences} 次，必须唯一`)
				}

				newContent = oldContent.replace(old_string, new_string)
			}

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

			if (decision === "apply") {
				try {
					if (isNewFile) {
						const dirPath = relativePath.substring(0, relativePath.lastIndexOf('/'))
						if (dirPath && dirPath !== '.' && dirPath !== '') {
							const dirExists = await vault.adapter.exists(dirPath)
							if (!dirExists) {
								await vault.adapter.mkdir(dirPath)
							}
						}
						await vault.create(relativePath, newContent)
					} else {
						if (!file) {
							throw new Error("文件不存在")
						}
						await vault.process(file, (content: string) => {
							return content.replace(old_string, new_string)
						})
					}
				} catch (error) {
					toolMessage.setContent(JSON.stringify({
						error: "文件操作失败",
						details: error instanceof Error ? error.message : "未知错误",
					}))
				}
			} else {
				toolMessage.setContent(JSON.stringify({
					cancelled: true,
					message: "用户拒绝了文件编辑",
				}))
			}

			toolMessage.setChildren(render(fileEdit, true, decision, handleApply, handleReject))
			toolMessage.close()
			context.addMessage(toolMessage)

			return JSON.stringify({
				success: decision === "apply" ? "用户接受了修改" : "用户拒绝了你的修改",
				file_path: relativePath
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
