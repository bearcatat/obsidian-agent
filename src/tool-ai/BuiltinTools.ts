import { BuiltinToolConfig } from '../types';

// 默认内置工具配置
export const DEFAULT_BUILTIN_TOOLS: BuiltinToolConfig[] = [
  {
    name: "getCurrentTime",
    description: "Get current time information",
    enabled: true,
  },
  {
    name: "readNoteByPath",
    description: "Read note content by file path", 
    enabled: true,
  },
  {
    name: "readNoteByLink",
    description: "Read note content by link",
    enabled: true,
  },
  {
    name: "askQuestion",
    description: "Ask a question",
    enabled: true,
  },
  {
    name: "editFile",
    description: "Edit file content by replacing text",
    enabled: true,
  },
  {
    name: "write",
    description: "Create or overwrite a note",
    enabled: true,
  },
  {
    name: "webFetch",
    description: "Fetch content from a URL",
    enabled: true,
  },
  {
    name: "search",
    description: "Search for content in local Markdown files",
    enabled: true,
  }
];

// 获取默认配置的函数（便于未来扩展）
export function getDefaultBuiltinTools(): BuiltinToolConfig[] {
  return [...DEFAULT_BUILTIN_TOOLS];
}
