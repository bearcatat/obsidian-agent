import { ToolClass } from "../types";
import GetCurrentTimeTool from "./Time/GetCurrentTime/GetCurrentTimeTool";
import ReadNoteByPathTool from "./ReadNote/ReadNoteByPath/ReadNoteByPathTool";
import ReadNoteByLinkTool from "./ReadNote/ReadNoteByLink/ReadNoteByLinkTool";
import AISearchTool from "./AISearch/AISearchTool";
import { StructuredToolInterface } from "@langchain/core/tools";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { Message } from "../types";

export default class ToolManager {
  private static instance: ToolManager;
  private tools: ToolClass[] = [
    GetCurrentTimeTool.getInstance(),
    ReadNoteByPathTool.getInstance(),
    ReadNoteByLinkTool.getInstance(),
    AISearchTool.getInstance(),
  ];
  private toolsMap: Map<string, ToolClass> = new Map();

  private constructor() {
    this.tools.forEach(tool => {
      this.toolsMap.set(tool.getTool().name, tool);
    });
  }

  static getInstance(): ToolManager {
    if (!ToolManager.instance) {
      ToolManager.instance = new ToolManager();
    }
    return ToolManager.instance;
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
    ToolManager.instance = undefined as any;
  }
}