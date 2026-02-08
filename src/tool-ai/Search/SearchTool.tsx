import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { MessageV2 } from "@/types";
import { searchSchema, SearchParams, SearchMetadata } from "./types";
import { searchVault, calculateTotalMatches } from "./utils/search-utils";
import { generateSearchMetadata, formatSearchResults } from "./utils/result-formatter";

export const toolName = "search"

export const SearchTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: searchSchema,
	execute: async (args, { toolCallId, experimental_context }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		try {
			const toolMessage = ToolMessage.from(toolName, toolCallId)
			const params = args as SearchParams
			const { content, metadata } = await executeSearch(params)
			toolMessage.setContent(content)
			toolMessage.setChildren(render(params.query, metadata))
			toolMessage.close()
			context.addMessage(toolMessage)
			return content
		} catch (error) {
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			context.addMessage(errorMessage)
			throw error
		}
	}
})

async function executeSearch(params: SearchParams): Promise<{ content: string; metadata: SearchMetadata }> {
	const app = getGlobalApp()
	const vault = app.vault

	try {
		const results = await searchVault(vault, params)

		const totalFiles = vault.getMarkdownFiles().length
		const totalMatches = calculateTotalMatches(results)

		const metadata = generateSearchMetadata(
			totalFiles,
			results.length,
			totalMatches,
			0,
			params.limit,
			results.length
		)

		return {
			content: formatSearchResults(results, metadata, params.showContextLines),
			metadata
		}

	} catch (error) {
		if (error instanceof Error) {
			let errorMessage = error.message
			if (errorMessage.includes("Invalid regex")) {
				throw new Error(`Invalid regular expression: ${error.message}`)
			} else if (errorMessage.includes("path not found")) {
				throw new Error(`Search path not found: ${error.message}`)
			}
			throw error
		}
		throw new Error(`Search failed: ${String(error)}`)
	}
}

function render(searchQuery: string, metadata: SearchMetadata): React.ReactNode {
	return (
		<div className="tw-flex tw-items-center tw-gap-2">
			<span>Search: "{searchQuery}"</span>
			{metadata.matchedFiles > 0 && (
				<span className="tw-text-sm tw-text-muted-foreground">
					({metadata.matchedFiles} files, {metadata.totalMatches} matches)
				</span>
			)}
		</div>
	)
}
