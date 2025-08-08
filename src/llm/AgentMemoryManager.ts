import { BaseMessageLike } from "@langchain/core/messages";
import { Message } from "@/types";
import { UserBaseMessageLike, AssistantBaseMessageLike, ToolBaseMessageLike } from "@/utils";

export default class AgentMemoryManager {
  private static instance: AgentMemoryManager;
  private messages: BaseMessageLike[];

  static getInstance(): AgentMemoryManager {
    if (!AgentMemoryManager.instance) {
      AgentMemoryManager.instance = new AgentMemoryManager();
    }
    return AgentMemoryManager.instance;
  }

  private constructor() {
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

  static resetInstance(): void {
    AgentMemoryManager.instance = undefined as any;
  }
}
