import { Plugin, TFile } from 'obsidian';
import { ToolLoopAgentSettings } from 'ai';


/**
 * Obsidian Agent 插件接口
 * 定义了插件的基本结构和行为
 */
export interface IObsidianAgentPlugin extends Plugin {
  // /** 插件设置 */
  // settings: ObsidianAgentSettings;
  /** 加载设置 */
  loadSettings(): Promise<void>;
  /** 保存设置 */
  saveSettings(): Promise<void>;
}

export interface MessageV2 {
  id: string;
  role: "user" | "assistant" | "tool" | "thinking" | "error" | "none";
  isStreaming: boolean;
  content: string;
  reasoning_content?: string;
  render(): React.ReactElement;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
}

// Model Providers
export enum ModelProviders {
  OPENAI = "openai",
  DEEPSEEK = "deepseek",
  ANTHROPIC = "anthropic",
  OPENAI_FORMAT = "openai-format",
  MOONSHOT = "moonshot",
}
export interface AIModelGenerator {
  newAgent(modelConfig: ModelConfig): ToolLoopAgentSettings;
}

// MCP Tool Configuration
export interface MCPToolConfig {
  name: string;
  description?: string;
  enabled: boolean;
}

// MCP Server Configuration
export interface MCPServerConfig {
  name: string;
  transport: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>; // 新增：stdio环境变量支持
  url?: string;
  headers?: Record<string, string>; // 新增：HTTP headers支持
  tools?: MCPToolConfig[]; // 新增：MCP工具配置
}

// MCP Transport Types
export enum MCPTransportTypes {
  STDIO = "stdio",
  HTTP = "http",
  SSE = "sse",
}

// 内置工具配置
export interface BuiltinToolConfig {
  name: string;
  description: string;
  enabled: boolean;
}

// SubAgent Tool Configuration
export interface SubAgentToolConfig {
  type: "builtin" | "mcp" | "subAgent";
  name: string;
  enabled: boolean;
}

// SubAgent Configuration
export interface SubAgentConfig {
  name: string;
  systemPrompt: string;
  description: string;
  enabled: boolean;
  modelId: string;
  tools: SubAgentToolConfig[];
}

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface Question {
  id: string;
  question: string;
  options: QuestionOption[];
  header?: string;
  multiple?: boolean;
  custom?: boolean;
}

export interface FileEdit {
  id: string;
  file_path: string;
  old_string: string;
  new_string: string;
  old_content?: string;  // 完整旧文件内容（用于 diff 显示）
  new_content?: string;  // 完整新文件内容（用于 diff 显示）
}

export interface Context {
  activeNote: TFile | null;
  notes: TFile[];
  images: string[];
}