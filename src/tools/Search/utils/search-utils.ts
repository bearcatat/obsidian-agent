import { TFile, Vault } from "obsidian";
import { SearchParams, SearchResult, SearchError, SearchErrorType } from "../types";
import { createSearchPattern, searchInText, searchInFilename } from "./regex-utils";
import { filterFilesByPath, validateSearchPath } from "./path-utils";

/**
 * 搜索vault中的Markdown文件
 */
export async function searchVault(
  vault: Vault,
  params: SearchParams
): Promise<SearchResult[]> {
  const startTime = Date.now();
  
  try {
    // 验证搜索路径
    const validatedPath = validateSearchPath(params.path);
    
    // 获取所有Markdown文件
    const allFiles = vault.getMarkdownFiles();
    
    // 路径过滤
    const filteredFiles = filterFilesByPath(allFiles, validatedPath);
    
    if (filteredFiles.length === 0) {
      if (validatedPath) {
        throw new SearchError(
          `在路径 "${validatedPath}" 下未找到Markdown文件`,
          SearchErrorType.PATH_NOT_FOUND,
          { path: validatedPath }
        );
      }
      return [];
    }
    
    // 创建搜索模式
    const searchPattern = createSearchPattern(
      params.query,
      params.useRegex,
      params.caseSensitive
    );
    
    // 并行搜索文件
    const searchPromises = filteredFiles.map(async (file): Promise<SearchResult | null> => {
      try {
        const result: SearchResult = {
          file,
          matches: [],
          filenameMatch: false,
        };
        
        // 文件名搜索
        if (params.searchType !== "content") {
          if (searchInFilename(file.name, searchPattern, params.caseSensitive)) {
            result.filenameMatch = true;
            // 如果只需要文件名搜索，直接返回
            if (params.searchType === "filename") {
              return result;
            }
          }
        }
        
        // 内容搜索（如果需要）
        if (params.searchType !== "filename" && !result.filenameMatch) {
          const content = await vault.cachedRead(file);
          const matches = searchInText(content, searchPattern, params.showContextLines);
          if (matches.length > 0) {
            result.matches = matches;
          }
        }
        
        // 只返回有匹配结果的文件
        if (result.filenameMatch || result.matches.length > 0) {
          return result;
        }
        
        return null;
      } catch (error) {
        // 单个文件搜索失败，记录错误但继续搜索其他文件
        console.warn(`搜索文件 "${file.path}" 时出错:`, error);
        return null;
      }
    });
    
    // 等待所有搜索完成
    const searchResults = await Promise.all(searchPromises);
    
    // 过滤掉null结果并排序
    const validResults = searchResults
      .filter((result): result is SearchResult => result !== null)
      .sort(sortSearchResults);
    
    // 应用数量限制
    const limitedResults = validResults.slice(0, params.limit);
    
    const searchTime = Date.now() - startTime;
    console.log(`搜索完成: 搜索了 ${filteredFiles.length} 个文件，找到 ${limitedResults.length} 个匹配文件，耗时 ${searchTime}ms`);
    
    return limitedResults;
    
  } catch (error) {
    if (error instanceof SearchError) {
      throw error;
    }
    
    // 其他错误转换为SearchError
    throw new SearchError(
      `搜索失败: ${error instanceof Error ? error.message : String(error)}`,
      SearchErrorType.VAULT_ERROR,
      { originalError: error }
    );
  }
}

/**
 * 搜索结果排序函数
 */
function sortSearchResults(a: SearchResult, b: SearchResult): number {
  // 优先按匹配数量排序
  const aScore = a.matches.length + (a.filenameMatch ? 1 : 0);
  const bScore = b.matches.length + (b.filenameMatch ? 1 : 0);
  
  if (bScore !== aScore) {
    return bScore - aScore;
  }
  
  // 其次按文件修改时间排序（新的在前）
  try {
    // @ts-ignore - TFile可能有stat属性
    const aTime = a.file.stat?.mtime || 0;
    // @ts-ignore - TFile可能有stat属性
    const bTime = b.file.stat?.mtime || 0;
    return bTime - aTime;
  } catch {
    // 如果无法获取修改时间，按文件名排序
    return a.file.name.localeCompare(b.file.name);
  }
}

/**
 * 计算总匹配数
 */
export function calculateTotalMatches(results: SearchResult[]): number {
  return results.reduce((total, result) => {
    return total + result.matches.length + (result.filenameMatch ? 1 : 0);
  }, 0);
}