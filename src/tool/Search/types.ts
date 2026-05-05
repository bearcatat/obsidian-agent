import { TFile } from "obsidian";
import { z } from "zod";

/**
 * Search parameters
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
 * Match result
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
 * Search result
 */
export interface SearchResult {
  file: TFile;
  matches: Match[];
  filenameMatch: boolean;
}

/**
 * Search error types
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
 * Search error class
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
 * Search parameters validation schema
 */
export const searchSchema = z.object({
  query: z.string()
    .min(1, "Search query cannot be empty")
    .describe("Search keyword or regular expression (full regex syntax supported)"),
  
  searchType: z.enum(["content", "filename", "both"])
    .default("both")
    .describe("Search type: content (content search), filename (filename search), both (search both)"),
  
  caseSensitive: z.boolean()
    .default(false)
    .describe("Whether to be case sensitive (default: false)"),
  
  useRegex: z.boolean()
    .default(false)
    .describe("Whether to use regular expression (default: simple text matching)"),
  
  limit: z.number()
    .min(1, "Result limit must be at least 1")
    .max(200, "Result limit cannot exceed 200")
    .default(50)
    .describe("Limit on number of returned results (1-200, default 50)"),
  
  path: z.string()
    .optional()
    .describe("Search path (relative to vault root, e.g., 'project/docs/', leave empty to search entire vault)"),
  
  showContextLines: z.number()
    .min(0, "Context line count cannot be negative")
    .max(5, "Context line count cannot exceed 5")
    .default(1)
    .describe("Number of context lines to show for matching lines (0-5, default 1)"),
});

/**
 * Search metadata
 */
export interface SearchMetadata {
  totalFiles: number;
  matchedFiles: number;
  totalMatches: number;
  searchTime: number;
  truncated: boolean;
}
