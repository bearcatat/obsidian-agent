import { tool } from "@langchain/core/tools";
import { DESCRIPTION } from "./prompts";
import { StructuredToolInterface } from "@langchain/core/tools";
import { MessageV2 } from "../../types";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { getGlobalApp } from "@/utils";
import { ToolMessage } from "@/messages/tool-message";
import { createToolError } from "@/utils/error-utils";
import { searchSchema, SearchParams, SearchError, SearchErrorType } from "./types";
import { searchVault, calculateTotalMatches } from "./utils/search-utils";
import { generateSearchMetadata, formatSearchResults } from "./utils/result-formatter";

export default class SearchTool {
  private static instance: SearchTool;
  private tool: StructuredToolInterface;
  private searchQuery: string;
  private searchResults: any[] = [];

  static getInstance(): SearchTool {
    if (!SearchTool.instance) {
      SearchTool.instance = new SearchTool();
    }
    return SearchTool.instance;
  }

  private constructor() {
    // 创建工具函数
    const searchFunction = async (): Promise<string> => {
      return "搜索功能需要通过run方法调用";
    };

    this.tool = tool(searchFunction, {
      name: "search",
      description: DESCRIPTION,
      schema: searchSchema,
    });
  }

  /**
   * 执行搜索
   */
  private async executeSearch(params: SearchParams): Promise<string> {
    const app = getGlobalApp();
    const vault = app.vault;

    try {
      // 执行搜索
      const results = await searchVault(vault, params);
      this.searchResults = results;

      // 计算统计信息
      const totalFiles = vault.getMarkdownFiles().length;
      const totalMatches = calculateTotalMatches(results);
      
      const metadata = generateSearchMetadata(
        totalFiles,
        results.length,
        totalMatches,
        0, // 搜索时间在searchVault中计算
        params.limit,
        results.length
      );

      // 格式化结果
      return formatSearchResults(results, metadata, params.showContextLines);

    } catch (error) {
      if (error instanceof SearchError) {
        // 处理已知的搜索错误
        let errorMessage = error.message;
        let errorDetails = error.details;

        switch (error.type) {
          case SearchErrorType.INVALID_REGEX:
            errorMessage = `无效的正则表达式: ${error.message}`;
            break;
          case SearchErrorType.PATH_NOT_FOUND:
            errorMessage = `搜索路径不存在: ${error.message}`;
            break;
          case SearchErrorType.SEARCH_TIMEOUT:
            errorMessage = `搜索超时: ${error.message}`;
            break;
          case SearchErrorType.VALIDATION_ERROR:
            errorMessage = `参数验证失败: ${error.message}`;
            break;
          case SearchErrorType.PERMISSION_DENIED:
            errorMessage = `权限不足: ${error.message}`;
            break;
          case SearchErrorType.VAULT_ERROR:
            errorMessage = `Vault访问错误: ${error.message}`;
            break;
          default:
            errorMessage = `搜索错误: ${error.message}`;
            break;
        }

        throw new Error(JSON.stringify({
          error: errorMessage,
          details: errorDetails,
          type: error.type
        }));
      }

      // 其他错误
      throw error;
    }
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
      
      // 解析参数
      const params = toolCall.args as SearchParams;
      this.searchQuery = params.query;

      // 执行搜索
      const result = await this.executeSearch(params);
      
      // 设置消息内容
      toolMessage.setContent(result);
      toolMessage.setChildren(this.render());
      toolMessage.close();
      
      yield toolMessage;

    } catch (error) {
      // 处理搜索错误
      let errorMessage = "搜索失败";
      let errorDetails: Record<string, any> = {};

      try {
        // 尝试解析结构化错误
        const errorObj = JSON.parse(error as string);
        if (errorObj.error) {
          errorMessage = errorObj.error;
          errorDetails = errorObj.details || {};
        }
      } catch {
        // 如果不是JSON格式，使用原始错误消息
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      yield createToolError(
        toolCall,
        errorMessage,
        { 
          ...errorDetails,
          query: this.searchQuery,
          tool: "search"
        },
        "validation"
      );
    }
  }

  private render(): React.ReactNode {
    const resultCount = this.searchResults.length;
    const matchCount = this.searchResults.reduce((total, result) => {
      return total + result.matches.length + (result.filenameMatch ? 1 : 0);
    }, 0);

    return (
      <div className="tw-flex tw-items-center tw-gap-2">
        <span>搜索: "{this.searchQuery}"</span>
        {resultCount > 0 && (
          <span className="tw-text-sm tw-text-muted-foreground">
            ({resultCount} 个文件, {matchCount} 处匹配)
          </span>
        )}
      </div>
    );
  }
}