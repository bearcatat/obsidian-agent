import { LangChainAssistantMessage, LangChainToolMessage, Message, MessageV2 } from "@/types";
import ModelManager from "./ModelManager";
import AgentMemoryManager from "./AgentMemoryManager";
import { BaseMessageLike } from "@langchain/core/messages";
import { AssistantBaseMessageLike, ToolBaseMessageLike } from "@/utils";
import ToolManager from "@/tools/ToolManager";
import { getSystemPrompts, getTitleGenerationPrompt } from "./system-prompts";
import { TFile } from "obsidian";
import { AgentState } from "@/state/agent-state-impl";
import { UserMessage } from "@/messages/user-message";
import { AssistantMessage } from "@/messages/assistant-message";
import { ErrorMessage } from "@/messages/error-message";

export default class Agent {
  private static instance: Agent;
  private memoryManager: AgentMemoryManager;

  static getInstance(): Agent {
    if (!Agent.instance) {
      Agent.instance = new Agent();
      Agent.instance.memoryManager = new AgentMemoryManager();
    }
    return Agent.instance;
  }

  static resetInstance(): void {
    Agent.instance = undefined as any;
  }

  // query 
  async *query(message: UserMessage, activeNote: TFile|null, contextNotes: TFile[]): AsyncGenerator<MessageV2, void> {
    const enhancedMessage = this.getFullUserMessage(message, activeNote, contextNotes);
    this.memoryManager.appendMessage(enhancedMessage);
    const chatHistory = this.memoryManager.getMessages();
    const systemPrompts = await getSystemPrompts();
    const messages = [...systemPrompts, ...chatHistory];
    const abortController = AgentState.getInstance().abortController;
    if (!abortController) {
      throw new Error("Abort controller not found");
    }
    for await (const message of this.stream(messages, abortController)) {
      yield message;
      if (!message.isStreaming) {
        this.memoryManager.appendMessage(message);
      }
    }
  }

  getFullUserMessage(message: UserMessage, activeNote: TFile|null, contextNotes: TFile[]): UserMessage {
    const contextInfo = [];
    
    if (activeNote) {
      contextInfo.push(`📄 当前活动笔记: ${activeNote.path}`);
    }
    
    if (contextNotes.length > 0) {
      const contextPaths = contextNotes.map(note => note.path).join(' | ');
      contextInfo.push(`📚 相关上下文笔记: ${contextPaths}`);
    }
    
    const enhancedContent = contextInfo.length > 0 
      ? `## 上下文信息\n${contextInfo.join('\n')}\n\n## 用户消息\n${message.content}`
      : message.content;
      
    return new UserMessage(enhancedContent);
  }

  async *stream(
    messages: BaseMessageLike[],
    abortController: AbortController,
  ): AsyncGenerator<MessageV2, void> {
    let assistantMessage: AssistantMessage|null = null;
    const toolManager = ToolManager.getInstance();
    console.log("Agent.stream", messages);
    for await (const message of ModelManager.getInstance().getAgentModel().stream(messages, toolManager.getMainAgentEnabledTools(), abortController)) {
      yield message;
      if (message.role === "assistant") {
        assistantMessage = message as AssistantMessage;
      }
    }
    if (!assistantMessage) {  
      yield new ErrorMessage("Error: No assistant message");
      return;
    }
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return;
    }
    const toolMessages: LangChainToolMessage[] = [];
    for await (const message of toolManager.runTools(assistantMessage.tool_calls)) {
      yield message;
      if (!message.isStreaming) {
        toolMessages.push(message.toBaseMessageLike() as LangChainToolMessage);
      }
    }

    // 递归调用
    yield* this.stream([...messages,assistantMessage.toBaseMessageLike(), ...toolMessages], abortController);
  }

  // 生成聊天标题
  async generateTitle(userMessage: string): Promise<string> {
    const titleSystemPrompt = {
      role: "system",
      content: getTitleGenerationPrompt()
    };
    
    const messages = [
      titleSystemPrompt,
      { role: "user", content: userMessage }
    ];

    try {
      const response = await ModelManager.getInstance().getTitleModel().invoke(
        messages,
        [],
        new AbortController()
      );
      return response.content;
    } catch (error) {
      console.error('Failed to generate title:', error);
      // 如果标题生成失败，使用用户消息的前20个字符作为标题
      return userMessage.substring(0, 20) || "New Chat";
    }
  }

  async clearMemory(): Promise<void> {
    await this.memoryManager.clearMessages();
  }
}
