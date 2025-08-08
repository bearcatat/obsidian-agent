import { DESCRIPTION } from "./prompts";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TimeInfo, convertDateToTimeInfo } from "../common/common";
import { StructuredToolInterface } from "@langchain/core/tools";
import { Message } from "../../../types";
import { v4 as uuidv4 } from "uuid";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { ErrorMessage } from "@/utils";

export default class GetCurrentTimeTool {
  private static instance: GetCurrentTimeTool;
  private tool: StructuredToolInterface;

  static getInstance(): GetCurrentTimeTool {
    if (!GetCurrentTimeTool.instance) {
      GetCurrentTimeTool.instance = new GetCurrentTimeTool();
    }
    return GetCurrentTimeTool.instance;
  }

  private constructor() {
    this.tool = tool(this.getCurrentTime, {
      name: "getCurrentTime",
      description: DESCRIPTION,
      schema: z.object({}),
    });
  }


  private getCurrentTime(): TimeInfo {
    const now = new Date();
    return convertDateToTimeInfo(now);
  }
  
  getTool(): StructuredToolInterface {
    return this.tool;
  }

  async *run(toolCall: ToolCall): AsyncGenerator<Message, void> {
    if (!toolCall.id) {
      console.error(`Tool call id is undefined`);
      return;
    }
    try {
      const timeInfo = await this.tool.invoke(toolCall.args);
      yield {
        id: uuidv4(),
        content: JSON.stringify(timeInfo, null, 2),
        role: "tool",
        name: this.tool.name,
        tool_call_id: toolCall.id,
        isStreaming: false,
        call_tool_msg: `current time: ${timeInfo.formatted}`,
      };
    } catch (error) {
      yield ErrorMessage(error as string);
    }
  }
}
