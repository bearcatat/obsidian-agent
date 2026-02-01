import { TFile } from "obsidian";
import { z } from "zod";

/**
 * 搜索参数
 */
export interface SearchParams {
  query: string;
  searchType: "content" | "filename" | "both";
  caseSensitive: boolean;
  useRegex: boolean;
  limit: number;
  path?: string;
  showContextLines: number;
}

/**
 * 匹配结果
 */
export interface Match {
  lineNumber: number;
  lineText: string;
  startIndex: number;
  endIndex: number;
  contextBefore?: string[];
  contextAfter?: string[];
}

/**
 * 搜索结果
 */
export interface SearchResult {
  file: TFile;
  matches: Match[];
  filenameMatch: boolean;
}

/**
 * 搜索错误类型
 */
export enum SearchErrorType {
  INVALID_REGEX = "invalid_regex",
  PATH_NOT_FOUND = "path_not_found",
  PERMISSION_DENIED = "permission_denied",
  SEARCH_TIMEOUT = "search_timeout",
  VAULT_ERROR = "vault_error",
  VALIDATION_ERROR = "validation_error",
}

/**
 * 搜索错误类
 */
export class SearchError extends Error {
  constructor(
    message: string,
    public readonly type: SearchErrorType,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = "SearchError";
  }
}

/**
 * 搜索参数验证Schema
 */
export const searchSchema = z.object({
  query: z.string()
    .min(1, "搜索关键词不能为空")
    .describe("搜索关键词或正则表达式（支持完整正则语法）"),
  
  searchType: z.enum(["content", "filename", "both"])
    .default("both")
    .describe("搜索类型：content（内容搜索）、filename（文件名搜索）、both（两者都搜索）"),
  
  caseSensitive: z.boolean()
    .default(false)
    .describe("是否区分大小写（默认不区分）"),
  
  useRegex: z.boolean()
    .default(false)
    .describe("是否使用正则表达式（默认使用简单文本匹配）"),
  
  limit: z.number()
    .min(1, "结果数量限制至少为1")
    .max(200, "结果数量限制最多为200")
    .default(50)
    .describe("返回结果数量限制（1-200，默认50）"),
  
  path: z.string()
    .optional()
    .describe("搜索路径（相对vault根目录，如'项目/文档/'，留空则搜索整个vault）"),
  
  showContextLines: z.number()
    .min(0, "上下文行数不能为负数")
    .max(5, "上下文行数最多为5")
    .default(1)
    .describe("显示匹配行上下文的行数（0-5，默认1）"),
});

/**
 * 搜索元数据
 */
export interface SearchMetadata {
  totalFiles: number;
  matchedFiles: number;
  totalMatches: number;
  searchTime: number;
  truncated: boolean;
}