import { ToolSet } from "ai";
import { BuiltinToolConfig, MCPServerConfig, SubAgentConfig } from "../types";
import { GetCurrentTimeTool, toolName as GetCurrentTimeToolName } from "./Time/GetCurrentTime/GetCurrentTimeTool";
import { ReadNoteByPathTool, toolName as ReadNoteByPathToolName } from "./ReadNote/ReadNoteByPath/ReadNoteByPathTool";
import { ReadNoteByLinkTool, toolName as ReadNoteByLinkToolName } from "./ReadNote/ReadNoteByLink/ReadNoteByLinkTool";
import { QuestionTool, toolName as QuestionToolName } from "./Question/QuestionTool";
import { FileEditTool, toolName as FileEditToolName } from "./FileEdit/FileEditTool";
import { WebFetchTool, toolName as WebFetchToolName } from "./WebFetch/WebFetchTool";
import { SearchTool, toolName as SearchToolName } from "./Search/SearchTool";


export default class AIToolManager {
  private static instance: AIToolManager;
  private static readonly BUILTIN_TOOLS: ToolSet = {
    [GetCurrentTimeToolName]: GetCurrentTimeTool,
    [ReadNoteByPathToolName]: ReadNoteByPathTool,
    [ReadNoteByLinkToolName]: ReadNoteByLinkTool,
    [QuestionToolName]: QuestionTool,
    [FileEditToolName]: FileEditTool,
    [WebFetchToolName]: WebFetchTool,
    [SearchToolName]: SearchTool,
  }

  private allTools: ToolSet = {}
  private builtinToolConfigs: BuiltinToolConfig[] = [];
  private mainAgentEnableTools: ToolSet = {};

  static getInstance(): AIToolManager {
    if (!AIToolManager.instance) {
      AIToolManager.instance = new AIToolManager();
    }
    return AIToolManager.instance;
  }

  static resetInstance(): void {
    if (AIToolManager.instance) {
      // ToolManager.instance.mcpManager.closeClient();
      // ToolManager.instance.subAgentManager.close();
    }
    AIToolManager.instance = undefined as any;
  }

  async init() {
    await this.initializeTools()
  }

  async updateBuiltinTools(toolConfigs: BuiltinToolConfig[]): Promise<void> {
    this.builtinToolConfigs = toolConfigs;
    await this.initializeTools();
  }

  // 更新MCP服务器配置
  async updateMCPServers(servers: MCPServerConfig[]): Promise<void> {
  }

  // 更新SubAgent配置
  async updateSubAgents(subAgents: SubAgentConfig[]): Promise<void> {
  }

  getMainAgentEnabledTools(): ToolSet {
    return this.mainAgentEnableTools;
  }

  // 重新初始化工具
  private async initializeTools() {
    this.allTools = {
      ...AIToolManager.BUILTIN_TOOLS
    }
    this.mainAgentEnableTools = {
      ...this.getEnabledBuiltinTools()
    }
  }

  private getEnabledBuiltinTools(): ToolSet {
    // 根据配置过滤启用的内置工具
    const enabledToolNames = new Set(
      this.builtinToolConfigs.filter(t => t.enabled).map(t => t.name)
    );

    const enabledBuiltinTools = Object.entries(AIToolManager.BUILTIN_TOOLS).filter(([k, v]) =>
      v.title && enabledToolNames.has(v.title))
    return Object.fromEntries(enabledBuiltinTools);
  }
}