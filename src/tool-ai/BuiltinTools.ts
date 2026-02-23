import { BuiltinToolConfig, BashPermissionConfig } from '../types';

// 默认 Bash 权限配置
export const DEFAULT_BASH_PERMISSIONS: BashPermissionConfig = {
  default: "ask",
  rules: [
    { pattern: "git status*", permission: "allow" },
    { pattern: "git log*", permission: "allow" },
    { pattern: "git diff*", permission: "allow" },
    { pattern: "git *", permission: "ask" },
    { pattern: "npm *", permission: "allow" },
    { pattern: "node *", permission: "allow" },
    { pattern: "pnpm *", permission: "allow" },
    { pattern: "yarn *", permission: "allow" },
    { pattern: "rm *", permission: "deny" },
    { pattern: "del *", permission: "deny" },
    { pattern: "rmdir *", permission: "deny" },
    { pattern: "format *", permission: "deny" },
  ],
};

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
  },
  {
    name: "list",
    description: "List files and directories in a folder",
    enabled: true,
  },
  {
    name: "createArtifact",
    description: "Create a new command or skill file",
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
    permissions: DEFAULT_BASH_PERMISSIONS,
  }
];

// 获取默认配置的函数（便于未来扩展）
export function getDefaultBuiltinTools(): BuiltinToolConfig[] {
  return [...DEFAULT_BUILTIN_TOOLS];
}
