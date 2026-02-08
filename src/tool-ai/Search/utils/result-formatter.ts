import { SearchResult, SearchMetadata } from "../types";

/**
 * Format search results
 */
export function formatSearchResults(
  results: SearchResult[],
  metadata: SearchMetadata,
  showContextLines: number = 1
): string {
  if (results.length === 0) {
    return "No matching files found.";
  }

  const output: string[] = [];
  
  // Add summary information
  output.push(`## Search Results (${metadata.matchedFiles} files found, ${metadata.totalMatches} matches)`);
  output.push(`Search time: ${metadata.searchTime}ms`);
  if (metadata.truncated) {
    output.push(`*Note: Results truncated, showing only first ${results.length} files*`);
  }
  output.push("");

  // Format results for each file
  for (const result of results) {
    output.push(formatFileResult(result));
  }

  return output.join("\n");
}

/**
 * Format result for a single file
 */
function formatFileResult(result: SearchResult): string {
  const output: string[] = [];
  
  // File title
  const fileIcon = result.filenameMatch ? "📁" : "📄";
  output.push(`### ${fileIcon} ${result.file.name}`);
  output.push(`Path: ${result.file.path}`);
  output.push("");

  if (result.filenameMatch) {
    output.push("*(Filename match)*");
    output.push("");
  }

  // Matched content
  if (result.matches.length > 0) {
    output.push("Matched content:");
    
    for (const match of result.matches) {
      output.push(formatMatch(match));
    }
  }

  output.push(""); // Empty line between files
  return output.join("\n");
}

/**
 * Format a single match
 */
function formatMatch(match: SearchResult["matches"][0]): string {
  const output: string[] = [];
  
  // Add context lines (if any)
  if (match.contextBefore && match.contextBefore.length > 0) {
    for (const contextLine of match.contextBefore) {
      output.push(`  ${contextLine}`);
    }
  }
  
  // Highlight matching line
  const lineText = match.lineText;
  const highlightedLine = highlightMatchInLine(lineText, match.startIndex, match.endIndex);
  output.push(`- Line ${match.lineNumber}: ${highlightedLine}`);
  
  // Add context lines after (if any)
  if (match.contextAfter && match.contextAfter.length > 0) {
    for (const contextLine of match.contextAfter) {
      output.push(`  ${contextLine}`);
    }
  }
  
  return output.join("\n");
}

/**
 * Highlight matching part in line text
 */
function highlightMatchInLine(lineText: string, startIndex: number, endIndex: number): string {
  if (startIndex < 0 || endIndex > lineText.length || startIndex >= endIndex) {
    return lineText;
  }
  
  const before = lineText.substring(0, startIndex);
  const match = lineText.substring(startIndex, endIndex);
  const after = lineText.substring(endIndex);
  
  return `${before}**${match}**${after}`;
}

/**
 * Generate search metadata
 */
export function generateSearchMetadata(
  totalFiles: number,
  matchedFiles: number,
  totalMatches: number,
  searchTime: number,
  limit: number,
  resultsCount: number
): SearchMetadata {
  return {
    totalFiles,
    matchedFiles,
    totalMatches,
    searchTime,
    truncated: resultsCount >= limit
  };
}
