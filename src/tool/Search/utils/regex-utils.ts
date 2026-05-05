import { SearchError, SearchErrorType } from "../types";

/**
 * 验证正则表达式
 */
export function validateRegex(pattern: string, caseSensitive: boolean): RegExp {
  try {
    const flags = caseSensitive ? "g" : "gi";
    return new RegExp(pattern, flags);
  } catch (error) {
    throw new SearchError(
      `无效的正则表达式: ${error instanceof Error ? error.message : String(error)}`,
      SearchErrorType.INVALID_REGEX,
      { pattern, caseSensitive }
    );
  }
}

/**
 * 创建搜索模式（支持正则表达式和简单文本）
 */
export function createSearchPattern(query: string, useRegex: boolean, caseSensitive: boolean): RegExp | string {
  if (useRegex) {
    return validateRegex(query, caseSensitive);
  } else {
    // 简单文本搜索，转义正则特殊字符
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = caseSensitive ? "g" : "gi";
    return new RegExp(escapedQuery, flags);
  }
}

/**
 * 在文本中搜索匹配项
 */
export function searchInText(
  text: string,
  pattern: RegExp | string,
  showContextLines: number = 1
): Array<{
  lineNumber: number;
  lineText: string;
  startIndex: number;
  endIndex: number;
  contextBefore?: string[];
  contextAfter?: string[];
}> {
  const matches: Array<{
    lineNumber: number;
    lineText: string;
    startIndex: number;
    endIndex: number;
    contextBefore?: string[];
    contextAfter?: string[];
  }> = [];

  const lines = text.split('\n');
  let regex: RegExp;
  
  if (typeof pattern === 'string') {
    regex = new RegExp(pattern, 'g');
  } else {
    // 如果已经是RegExp对象，确保它是全局匹配且标志唯一
    const uniqueFlags = new Set(pattern.flags.split(''));
    uniqueFlags.add('g'); // 确保全局匹配
    const flags = Array.from(uniqueFlags).sort().join('');
    regex = new RegExp(pattern.source, flags);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    regex.lastIndex = 0; // 重置正则表达式状态
    
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      // 获取上下文行
      const contextBefore = showContextLines > 0 
        ? lines.slice(Math.max(0, i - showContextLines), i)
        : undefined;
      
      const contextAfter = showContextLines > 0
        ? lines.slice(i + 1, Math.min(lines.length, i + 1 + showContextLines))
        : undefined;

      matches.push({
        lineNumber: i + 1, // 行号从1开始
        lineText: line,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        contextBefore,
        contextAfter,
      });

      // 如果模式不是全局匹配，跳出循环
      if (!regex.global) {
        break;
      }
    }
  }

  return matches;
}

/**
 * 在文件名中搜索匹配项
 */
export function searchInFilename(
  filename: string,
  pattern: RegExp | string,
  caseSensitive: boolean = false
): boolean {
  if (typeof pattern === 'string') {
    const searchText = caseSensitive ? filename : filename.toLowerCase();
    const query = caseSensitive ? pattern : pattern.toLowerCase();
    return searchText.includes(query);
  } else {
    // 对于正则表达式，需要创建新的实例以避免状态问题
    // 从原始标志中提取唯一标志
    const uniqueFlags = new Set(pattern.flags.split(''));
    // 根据大小写敏感设置调整i标志
    if (caseSensitive) {
      uniqueFlags.delete('i');
    } else {
      uniqueFlags.add('i');
    }
    // 移除g标志（文件名搜索不需要全局匹配）
    uniqueFlags.delete('g');
    
    const flags = Array.from(uniqueFlags).sort().join('');
    const newPattern = new RegExp(pattern.source, flags);
    return newPattern.test(filename);
  }
}