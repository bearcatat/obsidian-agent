import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { MessageV2, ExaSearchConfig } from "@/types";
import { requestUrl } from "obsidian";

export const toolName = "exaWebSearch"

let exaConfig: ExaSearchConfig = {
	apiKey: "",
	enabled: false,
	numResults: 10,
	maxCharacters: 3000,
	livecrawl: "fallback",
};

export function updateExaConfig(config: ExaSearchConfig) {
	console.log("[ExaWebSearch] Config updated:", { 
		enabled: config.enabled, 
		hasApiKey: !!config.apiKey,
		numResults: config.numResults,
		maxCharacters: config.maxCharacters,
		livecrawl: config.livecrawl
	});
	exaConfig = config;
}

export const ExaWebSearchTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		query: z.string().min(1).describe("The search query to find relevant web content (prefer English for better results)"),
		numResults: z.number().min(1).max(20).optional().describe("Number of search results to return (1-20, default: 10)"),
	}),
	execute: async (args, { toolCallId, experimental_context }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		
		try {
			// Check if API key is configured
			if (!exaConfig.apiKey) {
				throw new Error("Exa API key is not configured. Please set it in the settings.");
			}

			if (!exaConfig.enabled) {
				throw new Error("Exa Web Search is disabled. Please enable it in the settings.");
			}

			const toolMessage = ToolMessage.from(toolName, toolCallId)
			
			// Execute Exa web search
			const searchResult = await executeExaSearch(args.query, args.numResults)
			
			toolMessage.setContent(searchResult)
			toolMessage.setChildren(render(args.query))
			toolMessage.close()
			context.addMessage(toolMessage)
			
			return searchResult
		} catch (error) {
			console.error("[ExaWebSearch] Error:", error);
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			context.addMessage(errorMessage)
			throw error
		}
	}
})

interface ExaSearchResult {
	title?: string;
	url?: string;
	text?: string;
	summary?: string;
	author?: string;
	publishedDate?: string;
}

async function executeExaSearch(query: string, numResults?: number): Promise<string> {
	try {
		// 构造 requestBody（参考 Exa SDK 实现）
		const requestBody: any = {
			query,
			type: "auto",
			numResults: numResults || exaConfig.numResults || 10,
			contents: {
				text: {
					maxCharacters: exaConfig.maxCharacters || 3000,
				},
				livecrawl: exaConfig.livecrawl || "fallback",
			},
		};
		
		// 直接使用 requestUrl 调用 Exa API（绕过 CORS）
		const response = await requestUrl({
			url: "https://api.exa.ai/search",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": exaConfig.apiKey,
			},
			body: JSON.stringify(requestBody),
		});
		
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Exa API error: ${response.status} - ${response.text}`);
		}
		
		const data = response.json;
		const results: ExaSearchResult[] = data.results || [];
		
		if (results.length === 0) {
			return "No results found for the search query.";
		}
		
		return formatExaResults(results);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Exa search failed: ${error.message}`);
		}
		throw new Error(`Exa search failed: ${String(error)}`);
	}
}

function formatExaResults(results: ExaSearchResult[]): string {
	if (!results || results.length === 0) {
		return "No results found.";
	}

	let formatted = `<exa_search_results count="${results.length}">\n\n`;

	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		formatted += `<result index="${i + 1}">\n`;
		formatted += `  <title>${escapeXml(result.title || "Untitled")}</title>\n`;
		formatted += `  <url>${escapeXml(result.url || "")}</url>\n`;
		
		if (result.author) {
			formatted += `  <author>${escapeXml(result.author)}</author>\n`;
		}
		
		if (result.publishedDate) {
			formatted += `  <publishedDate>${escapeXml(result.publishedDate)}</publishedDate>\n`;
		}
		
		if (result.summary) {
			formatted += `  <summary>${escapeXml(result.summary)}</summary>\n`;
		}
		
		if (result.text) {
			// Truncate very long text
			const text = result.text.length > 5000 
				? result.text.substring(0, 5000) + "... [truncated]" 
				: result.text;
			formatted += `  <content>${escapeXml(text)}</content>\n`;
		}
		
		formatted += `</result>\n\n`;
	}

	formatted += `</exa_search_results>`;
	return formatted;
}

function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function render(searchQuery: string): React.ReactNode {
	return `Exa Web Search: "${searchQuery}"`;
}
