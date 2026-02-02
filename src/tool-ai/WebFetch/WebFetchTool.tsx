import { tool } from "ai";
import { z } from "zod";
import TurndownService from "turndown";
import { DESCRIPTION } from "./prompts";
import { ToolMessage } from "@/messages/tool-message";
import { requestUrl } from "obsidian";
import { MessageV2 } from "@/types";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024
const DEFAULT_TIMEOUT = 30 * 1000
const MAX_TIMEOUT = 120 * 1000

export const toolName = "webFetch"

export const WebFetchTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		url: z.string().describe("The URL to fetch content from"),
		format: z.enum(["text", "markdown", "html"]).default("markdown").describe("The format to return the content in (text, markdown, or html). Defaults to markdown."),
		timeout: z.number().optional().describe("Optional timeout in seconds (max 120)"),
	}),
	execute: async ({ url, format, timeout }, { toolCallId, experimental_context }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		try {
			const toolMessage = ToolMessage.from(toolName, toolCallId)
			const result = await fetchWebContent({ url, format, timeout })
			toolMessage.setContent(result)
			toolMessage.setChildren(render(url))
			toolMessage.close()
			context.addMessage(toolMessage)
			return result
		} catch (error) {
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			context.addMessage(errorMessage)
			throw error
		}
	}
})

async function fetchWebContent({
	url,
	format,
	timeout,
}: {
	url: string
	format: "text" | "markdown" | "html"
	timeout?: number
}): Promise<string> {
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		throw new Error("URL must start with http:// or https://")
	}

	let targetUrl = url
	if (targetUrl.startsWith("http://")) {
		targetUrl = targetUrl.replace("http://", "https://")
	}

	const timeoutMs = Math.min((timeout ?? DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT)

	try {
		const response = await requestUrl({
			url: targetUrl,
			method: "GET",
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
				Accept: buildAcceptHeader(format),
				"Accept-Language": "en-US,en;q=0.9",
			},
		})

		const contentLength = response.headers["content-length"]
		if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
			throw new Error("Response too large (exceeds 5MB limit)")
		}

		const content = response.text
		if (content.length > MAX_RESPONSE_SIZE) {
			throw new Error("Response too large (exceeds 5MB limit)")
		}

		const contentType = response.headers["content-type"] || ""

		let processedContent: string
		switch (format) {
			case "markdown":
				if (contentType.includes("text/html")) {
					processedContent = convertHTMLToMarkdown(content)
				} else {
					processedContent = content
				}
				break

			case "text":
				if (contentType.includes("text/html")) {
					processedContent = extractTextFromHTML(content)
				} else {
					processedContent = content
				}
				break

			case "html":
				processedContent = content
				break

			default:
				processedContent = content
		}

		return genResult(targetUrl, contentType, processedContent)
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to fetch URL: ${error.message}`)
		}
		throw new Error("Failed to fetch URL: Unknown error")
	}
}

function buildAcceptHeader(format: "text" | "markdown" | "html"): string {
	switch (format) {
		case "markdown":
			return "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1"
		case "text":
			return "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1"
		case "html":
			return "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1"
		default:
			return "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
	}
}

function extractTextFromHTML(html: string): string {
	let text = html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
		.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
		.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, "")
		.replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, "")

	text = text
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<\/div>/gi, "\n\n")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")

	return text.trim()
}

function convertHTMLToMarkdown(html: string): string {
	const turndownService = new TurndownService({
		headingStyle: "atx",
		hr: "---",
		bulletListMarker: "-",
		codeBlockStyle: "fenced",
		emDelimiter: "*",
	})

	turndownService.remove(["script", "style", "meta", "link"])
	return turndownService.turndown(html)
}

function genResult(url: string, contentType: string, content: string): string {
	return `<metadata>
url: ${url}
content-type: ${contentType}
</metadata>
<content>
${content}
</content>`
}

function render(url: string): React.ReactNode {
	return `Fetched: ${url}`
}
