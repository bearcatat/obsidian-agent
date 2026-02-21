import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { MessageV2, BochaSearchConfig } from "@/types";
import { requestUrl } from "obsidian";

export const toolName = "bochaWebSearch"

let bochaConfig: BochaSearchConfig = {
	apiKey: "",
	enabled: false,
	count: 10,
	freshness: "noLimit",
};

export function updateBochaConfig(config: BochaSearchConfig) {
	bochaConfig = config;
}

export const BochaWebSearchTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		query: z.string().min(1).describe("The search query to find relevant web content (prefer English for better results)"),
		count: z.number().min(1).max(50).optional().describe("Number of search results to return (1-50, default: 10)"),
		freshness: z.enum(["noLimit", "oneYear", "oneMonth", "oneWeek", "oneDay"]).optional().describe("Time range for search results (default: noLimit)"),
	}),
	execute: async (args, { toolCallId, experimental_context }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		
		try {
			// Check if API key is configured
			if (!bochaConfig.apiKey) {
				throw new Error("Bocha API key is not configured. Please set it in the settings.");
			}

			if (!bochaConfig.enabled) {
				throw new Error("Bocha Web Search is disabled. Please enable it in the settings.");
			}

			const toolMessage = ToolMessage.from(toolName, toolCallId)
			
			// Execute Bocha web search
			const searchResult = await executeBochaSearch(
				args.query, 
				args.count, 
				args.freshness
			)
			
			toolMessage.setContent(searchResult)
			toolMessage.setChildren(render(args.query))
			toolMessage.close()
			context.addMessage(toolMessage)
			
			return searchResult
		} catch (error) {
			console.error("[BochaWebSearch] Error:", error);
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			context.addMessage(errorMessage)
			throw error
		}
	}
})

interface BochaSearchResult {
	name?: string;
	url?: string;
	summary?: string;
	datePublished?: string;
	siteName?: string;
}

async function executeBochaSearch(
	query: string, 
	count?: number, 
	freshness?: string
): Promise<string> {
	try {
		// 构造 requestBody
		const requestBody: any = {
			query,
			summary: true,
			freshness: freshness || bochaConfig.freshness || "noLimit",
			count: count || bochaConfig.count || 10,
		};
		
		// 直接使用 requestUrl 调用 Bocha API（绕过 CORS）
		const response = await requestUrl({
			url: "https://api.bochaai.com/v1/web-search",
			method: "POST",
			headers: {
				"Authorization": `Bearer ${bochaConfig.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});
		
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Bocha API error: ${response.status} - ${response.text}`);
		}
		
		const data = response.json;
		const results: BochaSearchResult[] = data.data?.webPages?.value || [];
		
		if (results.length === 0) {
			return "No results found for the search query.";
		}
		
		return formatBochaResults(results);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Bocha search failed: ${error.message}`);
		}
		throw new Error(`Bocha search failed: ${String(error)}`);
	}
}

function formatBochaResults(results: BochaSearchResult[]): string {
	if (!results || results.length === 0) {
		return "No results found.";
	}

	const formattedResults: string[] = [];

	for (const result of results) {
		const lines: string[] = [];
		lines.push(`Title: ${result.name || "Untitled"}`);
		lines.push(`URL: ${result.url || ""}`);
		lines.push(`Description: ${result.summary || ""}`);
		lines.push(`Published date: ${result.datePublished || ""}`);
		lines.push(`Site name: ${result.siteName || ""}`);
		formattedResults.push(lines.join("\n"));
	}

	return formattedResults.join("\n\n");
}

function render(searchQuery: string): React.ReactNode {
	return `Bocha Web Search: "${searchQuery}"`;
}
