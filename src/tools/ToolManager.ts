import { ToolClass, BuiltinToolConfig } from "../types";
import GetCurrentTimeTool from "./Time/GetCurrentTime/GetCurrentTimeTool";
import ReadNoteByPathTool from "./ReadNote/ReadNoteByPath/ReadNoteByPathTool";
import ReadNoteByLinkTool from "./ReadNote/ReadNoteByLink/ReadNoteByLinkTool";
import { StructuredToolInterface } from "@langchain/core/tools";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { MessageV2, MCPServerConfig, SubAgentConfig } from "../types";
import MCPManager from "./MCP/MCPManager";
import SubAgentManager from "./SubAgent/SubAgentManager";
import MCPToolAdaptor from "./MCP/MCPToolAdaptor";
import QuestionTool from "./Question/QuestionTool";
import FileEditTool from "./FileEdit/FileEditTool";
import WebFetchTool from "./WebFetch/WebFetchTool";
import SearchTool from "./Search/SearchTool";

export default class ToolManager {
  private static instance: ToolManager;
  private static readonly BUILTIN_TOOLS: ToolClass[] = [
    GetCurrentTimeTool.getInstance(),
    ReadNoteByPathTool.getInstance(),
    ReadNoteByLinkTool.getInstance(),
    QuestionTool.getInstance(),
    FileEditTool.getInstance(),
    WebFetchTool.getInstance(),
    SearchTool.getInstance(),
  ];
  private mainAgentEnableTools: ToolClass[] = [];
  private mcpManager: MCPManager;
  private subAgentManager: SubAgentManager;
  private toolsMap: Map<string, ToolClass> = new Map();
  private builtinToolConfigs: BuiltinToolConfig[] = [];
  private allTools: ToolClass[] = [];

  async init(): Promise<void> {
    this.mcpManager = new MCPManager();
    this.subAgentManager = new SubAgentManager();
    await this.initializeTools();
  }

  static getInstance(): ToolManager {
    if (!ToolManager.instance) {
      ToolManager.instance = new ToolManager();
    }
    return ToolManager.instance;
  }

  // 更新MCP服务器配置
  async updateMCPServers(servers: MCPServerConfig[]): Promise<void> {
    // 更新MCPManager配置
    this.mcpManager.updateMCPServers(servers);

    // 重新初始化工具
    await this.initializeTools();
  }

  // 更新SubAgent配置
  async updateSubAgents(subAgents: SubAgentConfig[]): Promise<void> {
    // 更新SubAgentManager配置
    await this.subAgentManager.updateSubAgents(subAgents);

    // 重新初始化工具
    await this.initializeTools();
  }

  // 更新内置工具配置
  async updateBuiltinTools(toolConfigs: BuiltinToolConfig[]): Promise<void> {
    this.builtinToolConfigs = toolConfigs;
    await this.initializeTools();
  }

  getEnabledBuiltinTools(): ToolClass[] {
    // 根据配置过滤启用的内置工具
    const enabledToolNames = new Set(
      this.builtinToolConfigs.filter(t => t.enabled).map(t => t.name)
    );

    const enabledBuiltinTools = ToolManager.BUILTIN_TOOLS.filter(tool =>
      enabledToolNames.has(tool.getTool().name)
    );
    return enabledBuiltinTools;
  }

  // 重新初始化工具
  private async initializeTools(): Promise<void> {
    // 1. 收集所有内置工具（不管是否启用）
    this.allTools = [
      ...ToolManager.BUILTIN_TOOLS,
      ...(await this.mcpManager.getAllTools()),
      ...this.subAgentManager.getAllSubAgents(),
    ];
    // 2. 设置所有工具
    this.subAgentManager.setAllSubAgentTools(this.allTools.map(tool => tool.getTool()));
    
    // 4. 根据配置过滤启用的工具
    this.toolsMap.clear();
    this.mainAgentEnableTools = [
      ...this.getEnabledBuiltinTools(),
      ...(await this.mcpManager.getEnabledTools()),
      ...this.subAgentManager.getEnabledTools(),
    ];
    
    // 7. 更新工具映射
    this.allTools.forEach(tool => {
      this.toolsMap.set(tool.getTool().name, tool);
    });
    
    console.log('All tools initialized:', this.allTools.length);
    console.log('Enabled tools:', this.mainAgentEnableTools.length);
  }

  getMainAgentEnabledTools(): StructuredToolInterface[] {
    return this.mainAgentEnableTools.map(tool => tool.getTool());
  }


  async *runTools(toolCalls: ToolCall[]): AsyncGenerator<MessageV2, void> {
    for (const toolCall of toolCalls) {
      const tool = this.toolsMap.get(toolCall.name);
      if (tool) {
        yield* tool.run(toolCall);
      }
    }
  }

  static resetInstance(): void {
    if (ToolManager.instance) {
      ToolManager.instance.mcpManager.closeClient();
      ToolManager.instance.subAgentManager.close();
    }
    ToolManager.instance = undefined as any;
  }

  async getMCPTools(server: MCPServerConfig): Promise<MCPToolAdaptor[]> {
    return this.mcpManager.getTools(server);
  }
}