import { BaseMessageLike } from "@langchain/core/messages";
import { Message, MessageV2 } from "@/types";
import { UserBaseMessageLike, AssistantBaseMessageLike, ToolBaseMessageLike } from "@/utils";

export default class AgentMemoryManager {
  private messages: BaseMessageLike[];

  constructor() {
    this.messages = [];
  }

  getMessages(): BaseMessageLike[] {
    return this.messages;
  }

  appendMessage(message: Message | MessageV2): void {
    const baseMessage = this.handleMessage(message);
    if (baseMessage) {
      this.messages.push(baseMessage);
    }
  }

  handleMessage(message: Message | MessageV2): BaseMessageLike | undefined {
    if ('toBaseMessageLike' in message && typeof message.toBaseMessageLike === 'function') {
      return message.toBaseMessageLike();
    }
    const msg = message as Message;
    if (msg.is_sub_agent) {
      return undefined;
    }
    if (msg.role === "user") {
      return UserBaseMessageLike(msg);
    }
    if (msg.role === "assistant") {
      return AssistantBaseMessageLike(msg);
    }
    if (msg.role === "tool") {
      return ToolBaseMessageLike(msg);
    }
    return undefined;
  }

  async clearMessages(): Promise<void> {
    this.messages = [];
  }
}
