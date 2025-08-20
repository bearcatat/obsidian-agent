import { ToolClass } from "../types";
import GetCurrentTimeTool from "./Time/GetCurrentTime/GetCurrentTimeTool";
import ReadNoteByPathTool from "./ReadNote/ReadNoteByPath/ReadNoteByPathTool";
import ReadNoteByLinkTool from "./ReadNote/ReadNoteByLink/ReadNoteByLinkTool";
import AISearchTool from "./AISearch/AISearchTool";
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
    AISearchTool.getInstance(),
  ];
  private tools: ToolClass[] = [];
  private mcpManager: MCPManager;
  private toolsMap: Map<string, ToolClass> = new Map();

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

  // 重新初始化工具
  private async initializeTools(): Promise<void> {

    // 保留内置工具
    this.toolsMap.clear();
    this.tools = [...ToolManager.BUILTIN_TOOLS];

    try {
      const mcpTools = await this.mcpManager.getTools();
      this.tools.push(...mcpTools);
    } catch (error) {
      console.error('Failed to get MCP tools:', error);
    }

    this.tools.forEach(tool => {
      this.toolsMap.set(tool.getTool().name, tool);
    });
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