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
  }
];

// 获取默认配置的函数（便于未来扩展）
export function getDefaultBuiltinTools(): BuiltinToolConfig[] {
  return [...DEFAULT_BUILTIN_TOOLS];
}
