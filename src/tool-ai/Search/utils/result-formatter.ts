import { SearchResult, SearchMetadata } from "../types";

/**
 * 格式化搜索结果
 */
export function formatSearchResults(
  results: SearchResult[],
  metadata: SearchMetadata,
  showContextLines: number = 1
): string {
  if (results.length === 0) {
    return "未找到匹配的文件。";
  }

  const output: string[] = [];
  
  // 添加摘要信息
  output.push(`## 搜索结果 (共找到 ${metadata.matchedFiles} 个文件，${metadata.totalMatches} 处匹配)`);
  output.push(`搜索耗时: ${metadata.searchTime}ms`);
  if (metadata.truncated) {
    output.push(`*注：结果已截断，只显示前 ${results.length} 个文件*`);
  }
  output.push("");

  // 格式化每个文件的结果
  for (const result of results) {
    output.push(formatFileResult(result));
  }

  return output.join("\n");
}

/**
 * 格式化单个文件的结果
 */
function formatFileResult(result: SearchResult): string {
  const output: string[] = [];
  
  // 文件标题
  const fileIcon = result.filenameMatch ? "📁" : "📄";
  output.push(`### ${fileIcon} ${result.file.name}`);
  output.push(`路径: ${result.file.path}`);
  output.push("");

  if (result.filenameMatch) {
    output.push("*(文件名匹配)*");
    output.push("");
  }

  // 匹配内容
  if (result.matches.length > 0) {
    output.push("匹配内容:");
    
    for (const match of result.matches) {
      output.push(formatMatch(match));
    }
  }

  output.push(""); // 文件间的空行
  return output.join("\n");
}

/**
 * 格式化单个匹配项
 */
function formatMatch(match: SearchResult["matches"][0]): string {
  const output: string[] = [];
  
  // 添加上下文行（如果有）
  if (match.contextBefore && match.contextBefore.length > 0) {
    for (const contextLine of match.contextBefore) {
      output.push(`  ${contextLine}`);
    }
  }
  
  // 高亮匹配行
  const lineText = match.lineText;
  const highlightedLine = highlightMatchInLine(lineText, match.startIndex, match.endIndex);
  output.push(`- 行 ${match.lineNumber}: ${highlightedLine}`);
  
  // 添加下下文行（如果有）
  if (match.contextAfter && match.contextAfter.length > 0) {
    for (const contextLine of match.contextAfter) {
      output.push(`  ${contextLine}`);
    }
  }
  
  return output.join("\n");
}

/**
 * 在行文本中高亮匹配部分
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
 * 生成搜索元数据
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