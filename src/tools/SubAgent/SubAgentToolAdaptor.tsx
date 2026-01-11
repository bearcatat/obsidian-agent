import { ToolCall } from "@langchain/core/dist/messages/tool";
import { MessageV2 } from "@/types";
import SubAgent from "@/llm/SubAgent";
import { StructuredToolInterface } from "@langchain/core/tools";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ErrorMessage } from "../../messages/error-message";
import { ToolMessage } from "../../messages/tool-message";
import { UserMessage } from "../../messages/user-message";
import { SubAgentMessagesCard } from "../../ui/components/agent-view/messages/messages";

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
      description: this.subAgent.description,
      schema: z.object({
        message: z.string().describe("The message to send to the sub agent, should include context information"),
        isNewChat: z.boolean().describe("Whether to start a new chat with the sub agent, if true, the sub agent will clear its memory"),
      }),
    });
  }

  async *run(toolCall: ToolCall): AsyncGenerator<MessageV2, void> {
    const args = toolCall.args as { message: string; isNewChat: boolean };
    const messageContent = args.message;
    const isNewChat = args.isNewChat;
    console.log("SubAgentToolAdaptor.run", this.subAgent.name, messageContent, isNewChat);
    let lastMessage: MessageV2 | null = null;
    let messages: MessageV2[] = [];
    try {
      const toolMessage = ToolMessage.fromToolCall(toolCall);
      yield toolMessage;
      for await (const message of this.query(isNewChat, messageContent)) {
        lastMessage = message;
        if (messages.length > 0 && message.id === messages[messages.length - 1]?.id) {
          messages.pop();
        }
        messages = [...messages, message];
        toolMessage.setChildren(this.render(messages));
        yield toolMessage;
      }
      if (lastMessage) {
        toolMessage.setContent(lastMessage.content);
        toolMessage.setChildren(this.render(messages));
        toolMessage.close();
        yield toolMessage;
      }
    } catch (error) {
      console.error("SubAgentToolAdaptor.run", error);
      yield new ErrorMessage(error as string);
    }
  }

  async *query(isNewChat: boolean, messageContent: string): AsyncGenerator<MessageV2, void> {
    if (isNewChat) {
      await this.subAgent.clearMemory();
    }
    const userMessage = new UserMessage(messageContent);
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

  private render(messages: MessageV2[]): React.ReactNode {
    console.log("SubAgentToolAdaptor.render", messages);
    return (
      <SubAgentMessagesCard messages={messages} />
    )
  }
}