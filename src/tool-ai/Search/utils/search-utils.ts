import { TFile, Vault } from "obsidian";
import { SearchParams, SearchResult, SearchError, SearchErrorType } from "../types";
import { createSearchPattern, searchInText, searchInFilename } from "./regex-utils";
import { filterFilesByPath, validateSearchPath } from "./path-utils";

/**
 * Search Markdown files in vault
 */
export async function searchVault(
  vault: Vault,
  params: SearchParams
): Promise<SearchResult[]> {
  const startTime = Date.now();
  
  try {
    // Validate search path
    const validatedPath = validateSearchPath(params.path);
    
    // Get all Markdown files
    const allFiles = vault.getMarkdownFiles();
    
    // Filter files by path
    const filteredFiles = filterFilesByPath(allFiles, validatedPath);
    
    if (filteredFiles.length === 0) {
      if (validatedPath) {
        throw new SearchError(
          `No Markdown files found in path "${validatedPath}"`,
          SearchErrorType.PATH_NOT_FOUND,
          { path: validatedPath }
        );
      }
      return [];
    }
    
    // Create search pattern
    const searchPattern = createSearchPattern(
      params.query,
      params.useRegex,
      params.caseSensitive
    );
    
    // Search files in parallel
    const searchPromises = filteredFiles.map(async (file): Promise<SearchResult | null> => {
      try {
        const result: SearchResult = {
          file,
          matches: [],
          filenameMatch: false,
        };
        
        // Filename search
        if (params.searchType !== "content") {
          if (searchInFilename(file.name, searchPattern, params.caseSensitive)) {
            result.filenameMatch = true;
            // If only filename search is needed, return directly
            if (params.searchType === "filename") {
              return result;
            }
          }
        }
        
        // Content search (if needed)
        if (params.searchType !== "filename" && !result.filenameMatch) {
          const content = await vault.cachedRead(file);
          const matches = searchInText(content, searchPattern, params.showContextLines);
          if (matches.length > 0) {
            result.matches = matches;
          }
        }
        
        // Only return files with matching results
        if (result.filenameMatch || result.matches.length > 0) {
          return result;
        }
        
        return null;
      } catch (error) {
        // Log error for single file but continue searching other files
        console.warn(`Error searching file "${file.path}":`, error);
        return null;
      }
    });
    
    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);
    
    // Filter out null results and sort
    const validResults = searchResults
      .filter((result): result is SearchResult => result !== null)
      .sort(sortSearchResults);
    
    // Apply limit
    const limitedResults = validResults.slice(0, params.limit);
    
    return limitedResults;
    
  } catch (error) {
    if (error instanceof SearchError) {
      throw error;
    }
    
    // Other errors converted to SearchError
    throw new SearchError(
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      SearchErrorType.VAULT_ERROR,
      { originalError: error }
    );
  }
}

/**
 * Search result sorting function
 */
function sortSearchResults(a: SearchResult, b: SearchResult): number {
  // Sort by match count first
  const aScore = a.matches.length + (a.filenameMatch ? 1 : 0);
  const bScore = b.matches.length + (b.filenameMatch ? 1 : 0);
  
  if (bScore !== aScore) {
    return bScore - aScore;
  }
  
  // Then sort by file modification time (newer first)
  try {
    // @ts-ignore - TFile may have stat property
    const aTime = a.file.stat?.mtime || 0;
    // @ts-ignore - TFile may have stat property
    const bTime = b.file.stat?.mtime || 0;
    return bTime - aTime;
  } catch {
    // Fallback to sorting by filename if modification time cannot be obtained
    return a.file.name.localeCompare(b.file.name);
  }
}

/**
 * Calculate total match count
 */
export function calculateTotalMatches(results: SearchResult[]): number {
  return results.reduce((total, result) => {
    return total + result.matches.length + (result.filenameMatch ? 1 : 0);
  }, 0);
}
