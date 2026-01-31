import { tool } from "@langchain/core/tools";
import { z } from "zod";
import TurndownService from "turndown";
import { DESCRIPTION } from "./prompts";
import { StructuredToolInterface } from "@langchain/core/tools";
import { MessageV2 } from "../../types";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { ToolMessage } from "@/messages/tool-message";
import { createToolError } from "@/utils/error-utils";
import { requestUrl, RequestUrlResponse } from "obsidian";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT = 30 * 1000; // 30 seconds
const MAX_TIMEOUT = 120 * 1000; // 2 minutes

export default class WebFetchTool {
  private static instance: WebFetchTool;
  private tool: StructuredToolInterface;
  private fetchedUrl: string;

  static getInstance(): WebFetchTool {
    if (!WebFetchTool.instance) {
      WebFetchTool.instance = new WebFetchTool();
    }
    return WebFetchTool.instance;
  }

  private constructor() {
    // Create a dummy function for tool registration
    const dummyFunc = async () => "dummy";
    this.tool = tool(dummyFunc, {
      name: "webFetch",
      description: DESCRIPTION,
      schema: z.object({
        url: z.string().describe("The URL to fetch content from"),
        format: z
          .enum(["text", "markdown", "html"])
          .default("markdown")
          .describe("The format to return the content in (text, markdown, or html). Defaults to markdown."),
        timeout: z.number().describe("Optional timeout in seconds (max 120)").optional(),
      }),
    });
  }

  private async fetchWebContent({
    url,
    format,
    timeout,
  }: {
    url: string;
    format: "text" | "markdown" | "html";
    timeout?: number;
  }): Promise<string> {
    // Validate URL
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("URL must start with http:// or https://");
    }

    // Upgrade HTTP to HTTPS
    let targetUrl = url;
    if (targetUrl.startsWith("http://")) {
      targetUrl = targetUrl.replace("http://", "https://");
    }

    const timeoutMs = Math.min((timeout ?? DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT);

    try {
      const response: RequestUrlResponse = await requestUrl({
        url: targetUrl,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
          Accept: this.buildAcceptHeader(format),
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      // Check response size
      const contentLength = response.headers["content-length"];
      if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
        throw new Error("Response too large (exceeds 5MB limit)");
      }

      const content = response.text;
      if (content.length > MAX_RESPONSE_SIZE) {
        throw new Error("Response too large (exceeds 5MB limit)");
      }

      const contentType = response.headers["content-type"] || "";

      // Process content based on requested format
      let processedContent: string;
      switch (format) {
        case "markdown":
          if (contentType.includes("text/html")) {
            processedContent = this.convertHTMLToMarkdown(content);
          } else {
            processedContent = content;
          }
          break;

        case "text":
          if (contentType.includes("text/html")) {
            processedContent = this.extractTextFromHTML(content);
          } else {
            processedContent = content;
          }
          break;

        case "html":
          processedContent = content;
          break;

        default:
          processedContent = content;
      }

      return WebFetchTool.genResult(targetUrl, contentType, processedContent);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch URL: ${error.message}`);
      }
      throw new Error("Failed to fetch URL: Unknown error");
    }
  }

  private buildAcceptHeader(format: "text" | "markdown" | "html"): string {
    switch (format) {
      case "markdown":
        return "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
      case "text":
        return "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
      case "html":
        return "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1";
      default:
        return "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
    }
  }

  private extractTextFromHTML(html: string): string {
    // Remove script, style, and other non-content tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, "")
      .replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, "");

    // Convert HTML to text
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
      .replace(/&#39;/g, "'");

    return text.trim();
  }

  private convertHTMLToMarkdown(html: string): string {
    const turndownService = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
    });

    turndownService.remove(["script", "style", "meta", "link"]);
    return turndownService.turndown(html);
  }

  private static genResult(url: string, contentType: string, content: string): string {
    return `<metadata>
url: ${url}
content-type: ${contentType}
</metadata>
<content>
${content}
</content>`;
  }

  getTool(): StructuredToolInterface {
    return this.tool;
  }

  async *run(toolCall: ToolCall): AsyncGenerator<MessageV2, void> {
    if (!toolCall.id) {
      console.error(`Tool call id is undefined`);
      return;
    }

    try {
      const toolMessage = ToolMessage.fromToolCall(toolCall);
      this.fetchedUrl = toolCall.args.url;
      const args = toolCall.args as { url: string; format: "text" | "markdown" | "html"; timeout?: number };
      const result = await this.fetchWebContent(args);
      toolMessage.setContent(result);
      toolMessage.setChildren(this.render());
      toolMessage.close();
      yield toolMessage;
    } catch (error) {
      yield createToolError(toolCall, error as string, { url: toolCall.args.url });
    }
  }

  private render(): React.ReactNode {
    return `Fetched: ${this.fetchedUrl}`;
  }
}
