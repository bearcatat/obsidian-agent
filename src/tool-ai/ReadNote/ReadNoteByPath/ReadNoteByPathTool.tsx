import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { MessageV2 } from "@/types";

export const toolName = "readNoteByPath"

export const ReadNoteByPathTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		filePath: z.string().describe("笔记文件的路径，例如：'项目/文档/README.md'"),
	}),
	execute: async ({ filePath }, { toolCallId, experimental_context }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		try {
			const toolMessage = ToolMessage.from(toolName, toolCallId)
			const result = await readNoteByPath(filePath)
			toolMessage.setContent(result)
			toolMessage.setChildren(render(filePath))
			toolMessage.close()
			context.addMessage(toolMessage)
			return result
		} catch (error) {
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			errorMessage.setContent(JSON.stringify({
				error: "Failed to read file",
				details: error instanceof Error ? error.message : "unknown error",
				filePath
			}))
			context.addMessage(errorMessage)
			throw error
		}
	}
})

async function readNoteByPath(filePath: string): Promise<string> {
	const app = getGlobalApp()
	const vault = app.vault

	const file = vault.getAbstractFileByPath(filePath)
	if (!file || typeof file !== "object" || !("basename" in file) || !("path" in file)) {
		throw new Error(`File does not exist or is not a note: The file at path "${filePath}" does not exist or is not a Markdown file`)
	}

	const filePathStr = file.path as string
	if (!filePathStr.toLowerCase().endsWith('.md')) {
		throw new Error(`File type not supported: Only .md files can be read, got "${filePathStr}"`)
	}

	try {
		const text = await vault.read(file as any)
		return genResult(file.basename as string, file.path as string, text)
	} catch (error) {
		throw new Error(`Error reading file: ${error instanceof Error ? error.message : "unknown error"}`)
	}
}

function addLineNumbers(content: string): string {
	const lines = content.split('\n')
	return lines.map((line, index) => `${index + 1}: ${line}`).join('\n')
}

function genResult(fileName: string, path: string, content: string): string {
	const numberedContent = addLineNumbers(content)
	return `<metadata>
title: ${fileName}
note path: ${path}
</metadata>
<content>
${numberedContent}
</content>`
}

function render(filePath: string): React.ReactNode {
	return `Read note by path: ${filePath}`
}
