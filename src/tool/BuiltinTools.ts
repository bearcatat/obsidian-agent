import { BuiltinToolConfig } from '../types';

function cloneBuiltinTool(tool: BuiltinToolConfig): BuiltinToolConfig {
  return { ...tool };
}

// 默认内置工具配置
export const DEFAULT_BUILTIN_TOOLS: BuiltinToolConfig[] = [
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
    name: "moveNote",
    description: "Move or rename a note using Obsidian link-safe APIs",
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
  },
  {
    name: "vaultRagSearch",
    description: "Search the current Vault Markdown index with semantic vectors",
    enabled: true,
  },
  {
    name: "list",
    description: "List files and directories in a folder",
    enabled: true,
  },
  {
    name: "skill",
    description: "Load a skill (SKILL.md file) on-demand",
    enabled: true,
  },
  {
    name: "bash",
    description: "Execute shell commands in vault directory",
    enabled: true,
  }
];

// 获取默认配置的函数（便于未来扩展）
export function getDefaultBuiltinTools(): BuiltinToolConfig[] {
  return DEFAULT_BUILTIN_TOOLS.map(cloneBuiltinTool);
}

export function normalizeBuiltinTools(savedBuiltinTools: BuiltinToolConfig[] = []): BuiltinToolConfig[] {
  const savedBuiltinToolsByName = new Map(savedBuiltinTools.map((tool) => [tool.name, tool]));

  return getDefaultBuiltinTools().map((builtinTool) => {
    const savedBuiltinTool = savedBuiltinToolsByName.get(builtinTool.name);
    return savedBuiltinTool
      ? { ...builtinTool, enabled: savedBuiltinTool.enabled }
      : builtinTool;
  });
}
