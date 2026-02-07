import { TFile, Vault } from "obsidian";
import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { FileEditToolMessageCard } from "@/ui/components/agent-view/messages/message/file-edit-tool-message-card";
import { FileEdit, MessageV2 } from "@/types";

export const toolName = "editFile"

interface FrontmatterResult {
  hasFrontmatter: boolean;
  frontmatter: string;
  body: string;
}

function extractFrontmatter(content: string): FrontmatterResult {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (match) {
    return {
      hasFrontmatter: true,
      frontmatter: match[1],
      body: match[2]
    }
  }
  return {
    hasFrontmatter: false,
    frontmatter: '',
    body: content
  }
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function findBestMatch(
  oldContent: string,
  old_string: string,
  replaceStr: string,
  replaceAll: boolean
): { matched: boolean; content: string; protected: boolean; message?: string } {
  const extracted = extractFrontmatter(oldContent)

  if (extracted.hasFrontmatter && extracted.frontmatter.includes(old_string)) {
    return {
      matched: false,
      content: oldContent,
      protected: true,
      message: 'old_string 位于 frontmatter 元数据中，禁止直接修改。如需修改元数据，请明确指定 frontmatter 区域。'
    }
  }

  const exactMatch = extracted.body.includes(old_string)
  if (exactMatch) {
    const newBody = replaceAll
      ? extracted.body.split(old_string).join(replaceStr)
      : extracted.body.replace(old_string, replaceStr)
    return {
      matched: true,
      content: extracted.hasFrontmatter
        ? `---\n${extracted.frontmatter}\n---\n${newBody}`
        : newBody,
      protected: false
    }
  }

  const trimmedOld = normalizeWhitespace(old_string)
  if (trimmedOld) {
    const lines = extracted.body.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (normalizeWhitespace(lines[i]) === trimmedOld) {
        const newLines = [...lines]
        newLines[i] = replaceStr
        return {
          matched: true,
          content: extracted.hasFrontmatter
            ? `---\n${extracted.frontmatter}\n---\n${newLines.join('\n')}`
            : newLines.join('\n'),
          protected: false
        }
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
		old_string: z.string().describe("要替换的文本（在笔记中必须是唯一的，创建新笔记时为空）"),
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

				const matchResult = findBestMatch(oldContent, old_string, new_string, replaceAll || false)

				if (!matchResult.matched) {
					if (matchResult.protected && matchResult.message) {
						throw new Error(matchResult.message)
					}
					throw new Error(`old_string 不匹配: 在文件中找不到匹配的 old_string`)
				}

				newContent = matchResult.content
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
						await vault.process(file, () => newContent)
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
