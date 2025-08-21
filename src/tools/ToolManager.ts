import { ToolClass, BuiltinToolConfig } from "../types";
import GetCurrentTimeTool from "./Time/GetCurrentTime/GetCurrentTimeTool";
import ReadNoteByPathTool from "./ReadNote/ReadNoteByPath/ReadNoteByPathTool";
import ReadNoteByLinkTool from "./ReadNote/ReadNoteByLink/ReadNoteByLinkTool";
import { StructuredToolInterface } from "@langchain/core/tools";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { Message, MCPServerConfig } from "../types";
import MCPManager from "./MCP/MCPManager";

export default class ToolManager {
  private static instance: ToolManager;
  private static readonly BUILTIN_TOOLS: ToolClass[] = [
    GetCurrentTimeTool.getInstance(),
    ReadNoteByPathTool.getInstance(),
    ReadNoteByLinkTool.getInstance(),
  ];
  private tools: ToolClass[] = [];
  private mcpManager: MCPManager;
  private toolsMap: Map<string, ToolClass> = new Map();
  private builtinToolConfigs: BuiltinToolConfig[] = [];

  async init(): Promise<void> {
    this.mcpManager = new MCPManager();
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

  // 更新内置工具配置
  async updateBuiltinTools(toolConfigs: BuiltinToolConfig[]): Promise<void> {
    this.builtinToolConfigs = toolConfigs;

    // 重新初始化工具
    await this.initializeTools();
  }

  getBuiltinTools(): ToolClass[] {
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
    // 保留内置工具
    this.toolsMap.clear();
    this.tools = [...this.getBuiltinTools()];

    try {
      const mcpTools = await this.mcpManager.getEnabledTools();
      this.tools.push(...mcpTools);
    } catch (error) {
      console.error('Failed to get MCP tools:', error);
    }

    this.tools.forEach(tool => {
      this.toolsMap.set(tool.getTool().name, tool);
    });
    console.log('Tools initialized:', this.tools);
  }

  getTools(): StructuredToolInterface[] {
    return this.tools.map(tool => tool.getTool());
  }

  async *runTools(toolCalls: ToolCall[]): AsyncGenerator<Message, void> {
    for (const toolCall of toolCalls) {
      const tool = this.toolsMap.get(toolCall.name);
      if (tool) {
        yield* tool.run(toolCall);
      }
    }
  }

  static resetInstance(): void {
    ToolManager.instance.mcpManager.closeClient();
    ToolManager.instance = undefined as any;
  }
}