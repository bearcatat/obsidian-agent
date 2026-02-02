import { ToolSet } from "ai";
import { BuiltinToolConfig, MCPServerConfig, SubAgentConfig } from "../types";
import { GetCurrentTimeTool, toolName as GetCurrentTimeToolName } from "./Time/GetCurrentTime/GetCurrentTimeTool";
import { ReadNoteByPathTool, toolName as ReadNoteByPathToolName } from "./ReadNote/ReadNoteByPath/ReadNoteByPathTool";
import { ReadNoteByLinkTool, toolName as ReadNoteByLinkToolName } from "./ReadNote/ReadNoteByLink/ReadNoteByLinkTool";
import { QuestionTool, toolName as QuestionToolName } from "./Question/QuestionTool";
import { FileEditTool, toolName as FileEditToolName } from "./FileEdit/FileEditTool";
import { WebFetchTool, toolName as WebFetchToolName } from "./WebFetch/WebFetchTool";
import { SearchTool, toolName as SearchToolName } from "./Search/SearchTool";
import MCPManager from "./MCP/MCPManager";
import SubAgentManager from "./SubAgent/SubAgentManager";


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

  private builtinToolConfigs: BuiltinToolConfig[] = [];
  private mainAgentEnableTools: ToolSet = {};
  private mcpManager: MCPManager;
  private subAgentManager: SubAgentManager;


  static getInstance(): AIToolManager {
    if (!AIToolManager.instance) {
      AIToolManager.instance = new AIToolManager();
    }
    return AIToolManager.instance;
  }

  static async resetInstance() {
    if (AIToolManager.instance) {
      await AIToolManager.instance.mcpManager.closeClient();
      // ToolManager.instance.subAgentManager.close();
    }
    AIToolManager.instance = undefined as any;
  }

  async init() {
    this.mcpManager = new MCPManager()
    this.subAgentManager = new SubAgentManager()
    await this.initializeTools()
  }

  async updateBuiltinTools(toolConfigs: BuiltinToolConfig[]): Promise<void> {
    this.builtinToolConfigs = toolConfigs;
    await this.initializeTools();
  }

  // 更新MCP服务器配置
  async updateMCPServers(servers: MCPServerConfig[]): Promise<void> {
    await this.mcpManager.updateMCPServers(servers)
    await this.initializeTools();
    console.log("ai mcp updated")
  }

  // 更新SubAgent配置
  async updateSubAgents(subAgents: SubAgentConfig[]): Promise<void> {
    this.subAgentManager.updateSubAgents(subAgents)
    await this.initializeTools();
    console.log("ai subagent updated")
  }

  getMainAgentEnabledTools(): ToolSet {
    return this.mainAgentEnableTools;
  }

  // 重新初始化工具
  private async initializeTools() {
    const allTools = {
      ...this.getBuiltinTools(false),
      ...await this.mcpManager.getTools(false)
    }
    this.mainAgentEnableTools = {
      ...this.getBuiltinTools(true),
      ...await this.mcpManager.getTools(true),
      ...this.subAgentManager.getEnabledTools(allTools)
    }
  }

  private getBuiltinTools(isEnabled: boolean): ToolSet {
    // 根据配置过滤启用的内置工具
    const enabledToolNames = new Set(
      this.builtinToolConfigs.filter(t => t.enabled).map(t => t.name)
    );

    const enabledBuiltinTools = Object.entries(AIToolManager.BUILTIN_TOOLS).filter(([k, v]) =>
      !isEnabled || v.title && enabledToolNames.has(v.title))
    return Object.fromEntries(enabledBuiltinTools);
  }

  async getMCPTools(server: MCPServerConfig): Promise<ToolSet> {
    return this.mcpManager.getClientTools(server);
  }
}