import { getLinkpath } from "obsidian";
import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { MessageV2 } from "@/types";

export const toolName = "readNoteByLink"

export const ReadNoteByLinkTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		linkPath: z.string().describe("笔记链接路径，例如：'项目计划'"),
		filePath: z.string().describe("当前笔记的完整路径"),
	}),
	execute: async ({ linkPath, filePath }, { toolCallId, experimental_context }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		try {
			const toolMessage = ToolMessage.from(toolName, toolCallId)
			const result = await readNoteByLink(linkPath, filePath)
			toolMessage.setContent(result)
			toolMessage.setChildren(render(linkPath))
			toolMessage.close()
			context.addMessage(toolMessage)
			return result
		} catch (error) {
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			errorMessage.setContent(JSON.stringify({
				error: "读取链接笔记失败",
				details: error instanceof Error ? error.message : "未知错误",
				linkPath,
				filePath
			}))
			context.addMessage(errorMessage)
			throw error
		}
	}
})

async function readNoteByLink(linkPath: string, filePath: string): Promise<string> {
	const app = getGlobalApp()
	const metadataCache = app.metadataCache
	const vault = app.vault

	const linkedNote = metadataCache.getFirstLinkpathDest(getLinkpath(linkPath), filePath)
	if (!linkedNote) {
		throw new Error(`链接笔记不存在: 链接 "${linkPath}" 对应的笔记不存在`)
	}

	try {
		const fileName = linkedNote.basename
		const path = linkedNote.path
		const text = await vault.read(linkedNote)
		return genResult(fileName, path, linkPath, text)
	} catch (error) {
		throw new Error(`读取链接笔记时发生错误: ${error instanceof Error ? error.message : "未知错误"}`)
	}
}

function genResult(fileName: string, path: string, linkPath: string, content: string): string {
	return `<metadata>
title: ${fileName}
note path: ${path}
link path: ${linkPath}
</metadata>
<content>
${content}
</content>`
}

function render(linkPath: string): React.ReactNode {
	return `Read note by link: ${linkPath}`
}
