import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { useAgentLogic } from "@/hooks/use-agent";
import { getGlobalApp } from "@/utils";

export const toolName = "readNoteByPath"

export const ReadNoteByPathTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		filePath: z.string().describe("笔记文件的路径，例如：'项目/文档/README.md'"),
	}),
	execute: async ({ filePath }, { toolCallId }) => {
		const { addMessage } = useAgentLogic()
		try {
			const toolMessage = ToolMessage.from(toolName, toolCallId)
			const result = await readNoteByPath(filePath)
			toolMessage.setContent(result)
			toolMessage.setChildren(render(filePath))
			toolMessage.close()
			addMessage(toolMessage)
			return result
		} catch (error) {
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			errorMessage.setContent(JSON.stringify({
				error: "读取文件失败",
				details: error instanceof Error ? error.message : "未知错误",
				filePath
			}))
			addMessage(errorMessage)
			throw error
		}
	}
})

async function readNoteByPath(filePath: string): Promise<string> {
	const app = getGlobalApp()
	const vault = app.vault

	const file = vault.getAbstractFileByPath(filePath)
	if (!file || typeof file !== "object" || !("basename" in file) || !("path" in file)) {
		throw new Error(`文件不存在或不是笔记文件: 路径 "${filePath}" 对应的文件不存在或不是Markdown文件`)
	}

	try {
		const text = await vault.read(file as any)
		return genResult(file.basename as string, file.path as string, text)
	} catch (error) {
		throw new Error(`读取文件时发生错误: ${error instanceof Error ? error.message : "未知错误"}`)
	}
}

function genResult(fileName: string, path: string, content: string): string {
	return `<metadata>
title: ${fileName}
note path: ${path}
</metadata>
<content>
${content}
</content>`
}

function render(filePath: string): React.ReactNode {
	return `Read note by path: ${filePath}`
}
