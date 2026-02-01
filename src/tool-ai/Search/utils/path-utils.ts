import { TFile } from "obsidian";
import { SearchError, SearchErrorType } from "../types";

/**
 * 验证搜索路径
 */
export function validateSearchPath(path?: string): string | undefined {
  if (!path) return undefined;
  
  // 清理路径：移除开头和结尾的斜杠，统一使用正斜杠
  const cleanPath = path
    .replace(/\\/g, '/') // 统一使用正斜杠
    .replace(/^\/+/, '') // 移除开头的斜杠
    .replace(/\/+$/, ''); // 移除结尾的斜杠
  
  if (!cleanPath) return undefined;
  
  // 检查路径是否包含非法字符或路径遍历
  if (cleanPath.includes('..') || cleanPath.includes('//')) {
    throw new SearchError(
      "搜索路径包含非法字符",
      SearchErrorType.VALIDATION_ERROR,
      { path }
    );
  }
  
  return cleanPath;
}

/**
 * 根据路径过滤文件
 */
export function filterFilesByPath(files: TFile[], path?: string): TFile[] {
  if (!path) return files;
  
  const normalizedPath = path.endsWith('/') ? path : path + '/';
  
  return files.filter(file => {
    // 检查文件是否在指定路径下
    return file.path.startsWith(normalizedPath) || 
           file.path === path; // 允许精确匹配文件
  });
}

