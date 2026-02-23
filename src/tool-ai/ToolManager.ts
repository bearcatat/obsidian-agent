import { ToolSet } from "ai";
import { BuiltinToolConfig, MCPServerConfig, ExaSearchConfig, BochaSearchConfig } from "../types";
import { GetCurrentTimeTool, toolName as GetCurrentTimeToolName } from "./Time/GetCurrentTime/GetCurrentTimeTool";
import { ReadNoteByPathTool, toolName as ReadNoteByPathToolName } from "./ReadNote/ReadNoteByPath/ReadNoteByPathTool";
import { ReadNoteByLinkTool, toolName as ReadNoteByLinkToolName } from "./ReadNote/ReadNoteByLink/ReadNoteByLinkTool";
import { QuestionTool, toolName as QuestionToolName } from "./Question/QuestionTool";
import { FileEditTool, toolName as FileEditToolName } from "./FileEdit/FileEditTool";
import { WriteTool, toolName as WriteToolName } from "./FileEdit/WriteTool";
import { WebFetchTool, toolName as WebFetchToolName } from "./WebFetch/WebFetchTool";
import { SearchTool, toolName as SearchToolName } from "./Search/SearchTool";
import { ExaWebSearchTool, toolName as ExaWebSearchToolName, updateExaConfig } from "./ExaSearch/ExaSearchTool";
import { BochaWebSearchTool, toolName as BochaWebSearchToolName, updateBochaConfig } from "./BochaSearch/BochaSearchTool";
import { ListTool, toolName as ListToolName } from "./List/ListTool";
import { CreateArtifactTool, toolName as CreateArtifactToolName } from "./CreateArtifact/CreateArtifactTool";
import { SkillTool, toolName as SkillToolName } from "./Skill/SkillTool";
import { BashTool, toolName as BashToolName } from "./Bash/BashTool";
import MCPManager from "./MCP/MCPManager";
import SubAgentManager from "./SubAgent/SubAgentManager";
import SubAgentLogic from "../logic/subagent-logic";


export default class AIToolManager {
  private static instance: AIToolManager;
  private static readonly BUILTIN_TOOLS: ToolSet = {
    [GetCurrentTimeToolName]: GetCurrentTimeTool,
    [ReadNoteByPathToolName]: ReadNoteByPathTool,
    [ReadNoteByLinkToolName]: ReadNoteByLinkTool,
    [QuestionToolName]: QuestionTool,
    [FileEditToolName]: FileEditTool,
    [WriteToolName]: WriteTool,
    [WebFetchToolName]: WebFetchTool,
    [SearchToolName]: SearchTool,
    [ListToolName]: ListTool,
    [CreateArtifactToolName]: CreateArtifactTool,
    [SkillToolName]: SkillTool,
    [BashToolName]: BashTool,
  }

  private builtinToolConfigs: BuiltinToolConfig[] = [];
  private mainAgentEnableTools: ToolSet = {};
  private mcpManager: MCPManager;
  private subAgentManager: SubAgentManager;
  private exaSearchConfig: ExaSearchConfig = {
    apiKey: "",
    enabled: false,
    numResults: 10,
    maxCharacters: 3000,
    livecrawl: "fallback",
  };
  private bochaSearchConfig: BochaSearchConfig = {
    apiKey: "",
    enabled: false,
    count: 10,
    freshness: "noLimit",
  };


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
  }

  // 更新SubAgent配置（现在由 SubAgentLogic 管理，这里只重新初始化工具）
  async updateSubAgents(): Promise<void> {
    await this.initializeTools();
  }

  // 更新Exa搜索配置
  async updateExaSearchConfig(config: ExaSearchConfig): Promise<void> {
    this.exaSearchConfig = config;
    updateExaConfig(config);
    await this.initializeTools();
  }

  // 更新Bocha搜索配置
  async updateBochaSearchConfig(config: BochaSearchConfig): Promise<void> {
    this.bochaSearchConfig = config;
    updateBochaConfig(config);
    await this.initializeTools();
  }

  getMainAgentEnabledTools(): ToolSet {
    return this.mainAgentEnableTools;
  }

  // 重新初始化工具
  private async initializeTools() {
    const allTools = {
      ...this.getBuiltinTools(false),
      ...await this.mcpManager.getTools(false),
      ...this.getExaSearchTool(false),
      ...this.getBochaSearchTool(false),
    }
    this.mainAgentEnableTools = {
      ...this.getBuiltinTools(true),
      ...await this.mcpManager.getTools(true),
      ...this.subAgentManager.getEnabledTools(allTools),
      ...this.getExaSearchTool(true),
      ...this.getBochaSearchTool(true),
    }
  }

  // 获取Exa搜索工具（条件性）
  private getExaSearchTool(isEnabled: boolean): ToolSet {
    const hasConfig = this.exaSearchConfig.apiKey && this.exaSearchConfig.enabled;

    if (!isEnabled) {
      // 返回工具定义（用于 allTools）
      return { [ExaWebSearchToolName]: ExaWebSearchTool };
    }

    // 仅在启用且有API key时返回工具
    if (hasConfig) {
      return { [ExaWebSearchToolName]: ExaWebSearchTool };
    }

    return {};
  }

  // 获取Bocha搜索工具（条件性）
  private getBochaSearchTool(isEnabled: boolean): ToolSet {
    const hasConfig = this.bochaSearchConfig.apiKey && this.bochaSearchConfig.enabled;

    if (!isEnabled) {
      // 返回工具定义（用于 allTools）
      return { [BochaWebSearchToolName]: BochaWebSearchTool };
    }

    // 仅在启用且有API key时返回工具
    if (hasConfig) {
      return { [BochaWebSearchToolName]: BochaWebSearchTool };
    }

    return {};
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
