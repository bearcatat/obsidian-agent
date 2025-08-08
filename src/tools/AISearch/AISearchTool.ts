import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { DESCRIPTION } from "./prompts";
import { StructuredToolInterface } from "@langchain/core/tools";
import { Message } from "../../types";
import { v4 as uuidv4 } from "uuid";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { ErrorMessage } from "@/utils";
import { SettingsState } from "../../state/settings-state-impl";

// API返回类型定义
interface WebPageResult {
  name: string;        // 页面标题
  url: string;         // 页面URL
  snippet: string;     // 摘要
  summary: string;     // 详细摘要
  siteName: string;    // 网站名称
  datePublished: string; // 发布时间
}

interface WebPageContent {
  webSearchUrl: string;
  value: any[]; // 原始API返回的完整数据
  someResultsRemoved?: boolean;
}

interface AISearchMessage {
  role: string;
  type: string;
  content_type: "webpage";
  content: string;
}

interface AISearchResponse {
  code: number;
  log_id: string;
  conversation_id: string;
  messages: AISearchMessage[];
}

interface AISearchParams {
  query: string;
  freshness?: "oneDay" | "oneWeek" | "oneMonth" | "oneYear" | "noLimit";
}

export default class AISearchTool {
  private static instance: AISearchTool;
  private tool: StructuredToolInterface;
  private baseUrl: string = "https://api.bochaai.com/v1/ai-search";

  static getInstance(): AISearchTool {
    if (!AISearchTool.instance) {
      AISearchTool.instance = new AISearchTool();
    }
    return AISearchTool.instance;
  }

  private constructor() {
    this.tool = tool(AISearchTool.search, {
      name: "aiSearch",
      description: DESCRIPTION,
      schema: z.object({
        query: z.string().describe("搜索查询字符串，描述你想要搜索的内容"),
        freshness: z
          .enum(["oneDay", "oneWeek", "oneMonth", "oneYear", "noLimit"])
          .optional()
          .describe("时间范围限制，默认为noLimit"),
      }),
    });
  }

  private static async search({
    query,
    freshness,
  }: {
    query: string;
    freshness?: "oneDay" | "oneWeek" | "oneMonth" | "oneYear" | "noLimit";
  }): Promise<string> {
    try {
      // 动态获取API密钥
      const settingsState = SettingsState.getInstance();
      const apiKey = settingsState?.bochaaiApiKey;
      
      // 检查API密钥
      if (!apiKey) {
        return JSON.stringify(
          {
            error: "API密钥未配置",
            details: "请在设置中配置博查AI API密钥",
          },
          null,
          2
        );
      }

      // 构建请求参数
      const requestBody = {
        query: query,
        freshness: freshness || "noLimit",
        answer: false,
        stream: false,
        count: 5,
      };

      // 发送API请求
      const response = await fetch("https://api.bochaai.com/v1/ai-search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify(
          {
            error: `API请求失败: ${response.status} ${response.statusText}`,
            details: errorText,
          },
          null,
          2
        );
      }

      const data: AISearchResponse = await response.json();
      
      // 验证响应结构
      if (data.code !== 200) {
        return JSON.stringify(
          {
            error: "API返回错误",
            details: `错误码: ${data.code}`,
          },
          null,
          2
        );
      }

      // 格式化搜索结果
      const formattedResults = AISearchTool.formatSearchResults(data);
      return JSON.stringify(formattedResults, null, 2);
    } catch (error) {
      console.error("AI搜索错误:", error);
      return JSON.stringify(
        {
          error: "搜索过程中发生错误",
          details: error instanceof Error ? error.message : "未知错误",
        },
        null,
        2
      );
    }
  }

  /**
   * 格式化搜索结果，提取有用信息
   */
  private static formatSearchResults(data: AISearchResponse): any {
    const results = {
      searchInfo: {
        logId: data.log_id,
        conversationId: data.conversation_id,
        totalMessages: data.messages.length,
      },
      webPages: [] as WebPageResult[],
    };

    // 解析每个消息
    data.messages.forEach((message) => {
      try {
        const content = JSON.parse(message.content);
        
        if (message.content_type === "webpage" && content.value && Array.isArray(content.value)) {
          // 只提取需要的字段
          const simplifiedResults = content.value.map((item: any) => ({
            name: item.name,
            url: item.url,
            snippet: item.snippet,
            summary: item.summary,
            siteName: item.siteName,
            datePublished: item.datePublished,
          }));
          results.webPages.push(...simplifiedResults);
        }
      } catch (parseError) {
        console.warn("解析消息内容失败:", parseError);
      }
    });

    return results;
  }

  getTool(): StructuredToolInterface {
    return this.tool;
  }

  async *run(toolCall: ToolCall): AsyncGenerator<Message, void> {
    if (!toolCall.id) {
      console.error(`Tool call id is undefined`);
      return;
    }
    try {
      const result = await this.tool.invoke(toolCall.args);
      yield {
        id: uuidv4(),
        content: result,
        role: "tool",
        name: this.tool.name,
        tool_call_id: toolCall.id,
        isStreaming: false,
        call_tool_msg: `AI搜索: ${toolCall.args.query}`,
      };
    } catch (error) {
      yield ErrorMessage(error as string);
    }
  }
}
