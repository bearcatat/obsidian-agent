import { ToolCall } from "@langchain/core/dist/messages/tool";
import { Message } from "@/types";
import SubAgent from "@/llm/SubAgent";
import { StructuredToolInterface } from "@langchain/core/tools";
import { v4 as uuidv4 } from "uuid";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export default class SubAgentToolAdaptor {
  private subAgent: SubAgent;
  private tool: StructuredToolInterface;

  constructor(subAgent: SubAgent) {
    this.subAgent = subAgent;
    this.tool = tool(({ message, isNewChat }: { message: string; isNewChat: boolean }) => {
      console.log("SubAgentToolAdaptor.tool", message, isNewChat);
      return "success";
    }, {
      name: this.subAgent.name,
      description: this.subAgent.systemPrompt,
      schema: z.object({
        message: z.string().describe("The message to send to the sub agent, should include context information"),
        isNewChat: z.boolean().describe("Whether to start a new chat with the sub agent, if true, the sub agent will clear its memory"),
      }),
    });
  }

  async *run(toolCall: ToolCall): AsyncGenerator<Message, void> {
    const args = toolCall.args as { message: string; isNewChat: boolean };
    const messageContent = args.message;
    const isNewChat = args.isNewChat;
    console.log("SubAgentToolAdaptor.run", this.subAgent.name, messageContent, isNewChat);
    let lastMessage: Message | null = null;
    try {
      for await (const message of this.query(isNewChat, messageContent)) {
        lastMessage = message;
        if (message.role === "tool" || message.role === "error") {
          yield message;
        }
      }
      if (lastMessage) {
        yield {
          id: uuidv4(),
          content: lastMessage.content,
          role: "tool",
          name: this.subAgent.name,
          tool_call_id: toolCall.id,
          isStreaming: false,
          call_tool_msg: `SubAgent: ${this.subAgent.name}`,
        } as Message;
      }
    } catch (error) {
      console.error("SubAgentToolAdaptor.run", error);
      yield {
        id: uuidv4(),
        content: "Error: " + error.message,
        role: "tool",
        name: this.subAgent.name,
        tool_call_id: toolCall.id,
        isStreaming: false,
        call_tool_msg: `SubAgent: ${this.subAgent.name} Error`,
      } as Message;
    }
  }

  async *query(isNewChat: boolean, messageContent: string): AsyncGenerator<Message, void> {
    if (isNewChat) {
      await this.subAgent.clearMemory();
    }
    const userMessage = {
      id: uuidv4(),
      content: messageContent,
      role: "user",
      isStreaming: false,
      is_sub_agent: false,
    } as Message;
    yield* this.subAgent.query(userMessage);
  }

  getTool(): StructuredToolInterface {
    return this.tool;
  }

  getToolName(): string {
    return this.tool.name;
  }

  setSubAgentTools(tools: StructuredToolInterface[]): void {
    this.subAgent.setTools(tools);
  }
}