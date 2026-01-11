import { DynamicStructuredTool } from "@langchain/core/tools";
import { ToolClass, MessageV2 } from "../../types";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { ErrorMessage } from "../../messages/error-message";
import { ToolMessage } from "../../messages/tool-message";



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

  async *run(toolCall: ToolCall): AsyncGenerator<MessageV2, void> {
    console.log("MCPToolAdaptor.run", this.tool.name);
    try {
      const result = await this.tool.invoke(toolCall.args);
      const toolMessage = ToolMessage.fromToolCall(toolCall);
      toolMessage.setContent(result);
      toolMessage.setChildren(this.render());
      toolMessage.close();
      yield toolMessage;
    } catch (error) {
      console.error("Error in MCPToolAdaptor.run", error);
      yield new ErrorMessage(error as string);
    }
  }

  private render(): React.ReactNode {
    return (
      `MCPToolAdaptor: ${this.tool.name}`
    )
  }
}