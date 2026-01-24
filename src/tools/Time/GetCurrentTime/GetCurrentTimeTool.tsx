import { DESCRIPTION } from "./prompts";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TimeInfo, convertDateToTimeInfo } from "../common/common";
import { StructuredToolInterface } from "@langchain/core/tools";
import { MessageV2 } from "../../../types";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { ToolMessage } from "@/messages/tool-message";
import { createToolError } from "@/utils/error-utils";

export default class GetCurrentTimeTool {
  private static instance: GetCurrentTimeTool;
  private tool: StructuredToolInterface;
  private timeInfo: TimeInfo;

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

  async *run(toolCall: ToolCall): AsyncGenerator<MessageV2, void> {
    if (!toolCall.id) {
      console.error(`Tool call id is undefined`);
      return;
    }
    try {
      const toolMessage = ToolMessage.fromToolCall(toolCall);
      this.timeInfo = await this.tool.invoke(toolCall.args);
      toolMessage.setContent(JSON.stringify(this.timeInfo, null, 2));
      toolMessage.setChildren(this.render());
      toolMessage.close();
      yield toolMessage;
    } catch (error) {
      yield createToolError(toolCall, error as string);
    }
  }

  private render(): React.ReactNode {
    return (
      `Current time: ${this.timeInfo.formatted}`
    )
  }
}
