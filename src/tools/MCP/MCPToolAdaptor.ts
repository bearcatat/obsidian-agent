import { DynamicStructuredTool } from "@langchain/core/tools";
import { ToolClass, Message } from "../../types";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { v4 as uuidv4 } from "uuid";
import { ErrorMessage } from "../../utils";


export default class MCPToolAdaptor implements ToolClass {
  private tool: DynamicStructuredTool;

  constructor(tool: DynamicStructuredTool) {
    this.tool = tool;
  }

  getTool(): DynamicStructuredTool {
    return this.tool;
  }

  getToolName(): string {
    return this.tool.name;
  }

  async *run(toolCall: ToolCall): AsyncGenerator<Message, void> {
    console.log("MCPToolAdaptor.run", this.tool.name);
    try {
      const result = await this.tool.invoke(toolCall.args);
      yield {
        id: uuidv4(),
        content: result,
        role: "tool",
        name: this.tool.name,
        tool_call_id: toolCall.id,
        isStreaming: false,
        call_tool_msg: `MCP: ${this.tool.name}`,
      };
    } catch (error) {
      console.error("Error in MCPToolAdaptor.run", error);
      yield {
        id: uuidv4(),
        content: `Error in MCPToolAdaptor.run: ${error.message}`,
        role: "tool",
        name: this.tool.name,
        tool_call_id: toolCall.id,
        isStreaming: false,
        call_tool_msg: `MCP: ${this.tool.name} Error`,
      };
    }
  }
}