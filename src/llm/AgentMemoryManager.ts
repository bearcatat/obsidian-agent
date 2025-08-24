import { BaseMessageLike } from "@langchain/core/messages";
import { Message } from "@/types";
import { UserBaseMessageLike, AssistantBaseMessageLike, ToolBaseMessageLike } from "@/utils";

export default class AgentMemoryManager {
  private messages: BaseMessageLike[];

  constructor() {
    this.messages = [];
  }

  getMessages(): BaseMessageLike[] {
    return this.messages;
  }

  appendMessage(message: Message): void {
    const baseMessage = this.handleMessage(message);
    if (baseMessage) {
      this.messages.push(baseMessage);
    }
  }

  handleMessage(message: Message): BaseMessageLike | undefined {
    if (message.is_sub_agent) {
      return undefined;
    }
    if (message.role === "user") {
      return UserBaseMessageLike(message);
    }
    if (message.role === "assistant") {
      return AssistantBaseMessageLike(message);
    }
    if (message.role === "tool") {
      return ToolBaseMessageLike(message);
    }
    return undefined;
  }

  async clearMessages(): Promise<void> {
    this.messages = [];
  }
}
