import { TFile } from "obsidian";
import { SearchError, SearchErrorType } from "../types";

/**
 * Validate search path
 */
export function validateSearchPath(path?: string): string | undefined {
  if (!path) return undefined;
  
  // Clean path: remove leading and trailing slashes, use forward slashes
  const cleanPath = path
    .replace(/\\/g, '/') // Use forward slashes
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/\/+$/, ''); // Remove trailing slashes
  
  if (!cleanPath) return undefined;
  
  // Check for invalid characters or path traversal
  if (cleanPath.includes('..') || cleanPath.includes('//')) {
    throw new SearchError(
      "Search path contains invalid characters",
      SearchErrorType.VALIDATION_ERROR,
      { path }
    );
  }
  
  return cleanPath;
}

/**
 * Filter files by path
 */
export function filterFilesByPath(files: TFile[], path?: string): TFile[] {
  if (!path) return files;
  
  const normalizedPath = path.endsWith('/') ? path : path + '/';
  
  return files.filter(file => {
    // Check if file is under the specified path
    return file.path.startsWith(normalizedPath) || 
           file.path === path; // Allow exact file match
  });
}
