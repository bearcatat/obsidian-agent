import { Plugin } from 'obsidian';
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { StructuredToolInterface } from '@langchain/core/tools';
import { BaseMessageLike } from '@langchain/core/messages';


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

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant" | "tool" | "thinking" | "error" | "none";
  isStreaming: boolean;
  // assistant message
  tool_calls?: ToolCall[];
  // tool message
  name?: string;
  call_tool_msg?: string;
  tool_call_id?: string;
  // sub agent
  is_sub_agent?: boolean;
}

export interface MessageV2 {
  id: string;
  role: "user" | "assistant" | "tool" | "thinking" | "error" | "none";
  isStreaming: boolean;
  content: string;
  render(): React.ReactElement;
  toBaseMessageLike(): BaseMessageLike|undefined;
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

export type AgentModel =
  | ChatDeepSeek
  | ChatOpenAI
  | ChatAnthropic

export interface ModelGenerator {
  newStreamer(modelConfig: ModelConfig): Promise<Streamer>;
  matchModel(modelConfig: ModelConfig): boolean;
}

export type LangChainMessage = LangChainUserMessage | LangChainAssistantMessage | LangChainToolMessage;

export type LangChainUserMessage = {
  role: "user";
  content: string;
};

export type LangChainAssistantMessage = {
  role: "assistant";
  content: string;
  tool_calls: ToolCall[];
};

export type LangChainToolMessage = {
  role: "tool";
  content: string;
  name: string;
  tool_call_id: string;
};

export interface Streamer {
  stream(messages: any, tools: StructuredToolInterface[], abortController: AbortController): AsyncGenerator<MessageV2, void>;
  invoke(messages: any, tools: StructuredToolInterface[], abortController: AbortController): Promise<MessageV2>;
}

export interface ToolClass {
  getTool(): StructuredToolInterface;
  run(toolCall: ToolCall): AsyncGenerator<MessageV2, void>;
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