import { LangChainAssistantMessage, LangChainToolMessage, Message } from "@/types";
import ModelManager from "./ModelManager";
import AgentMemoryManager from "./AgentMemoryManager";
import { BaseMessageLike } from "@langchain/core/messages";
import { AssistantBaseMessageLike, ErrorMessage, ToolBaseMessageLike } from "@/utils";
import ToolManager from "@/tools/ToolManager";
import { getSystemPrompts, getTitleGenerationPrompt } from "./system-prompts";
import { TFile } from "obsidian";

export default class Agent {
  private static instance: Agent;

  static getInstance(): Agent {
    if (!Agent.instance) {
      Agent.instance = new Agent();
    }
    return Agent.instance;
  }

  static resetInstance(): void {
    Agent.instance = undefined as any;
  }

  // query 
  async *query(message: Message, activeNote: TFile|null, contextNotes: TFile[], abortController: AbortController): AsyncGenerator<Message, void> {
    const enhancedMessage = this.getFullUserMessage(message, activeNote, contextNotes);
    AgentMemoryManager.getInstance().appendMessage(enhancedMessage);
    const chatHistory = AgentMemoryManager.getInstance().getMessages();
    const systemPrompts = await getSystemPrompts();
    const messages = [...systemPrompts, ...chatHistory];
    for await (const message of this.stream(messages, abortController)) {
      yield message;
      if (!message.isStreaming) {
        AgentMemoryManager.getInstance().appendMessage(message);
      }
    }
  }

  getFullUserMessage(message: Message, activeNote: TFile|null, contextNotes: TFile[]): Message {
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
      
    return {
      ...message,
      content: enhancedContent
    };
  }

  async *stream(
    messages: BaseMessageLike[],
    abortController: AbortController,
  ): AsyncGenerator<Message, void> {
    console.log("messages", messages);
    let assistantMessage: LangChainAssistantMessage|null = null ;
    for await (const message of ModelManager.getInstance().getAgentModel().stream(messages, ToolManager.getInstance().getTools(), abortController)) {
      assistantMessage = AssistantBaseMessageLike(message);
      yield message;
    }
    if (!assistantMessage) {  
      yield ErrorMessage("Error: No assistant message");
      return;
    }
    // console.log("assistantMessage", assistantMessage);
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return;
    }
    const toolMessages: LangChainToolMessage[] = [];
    for await (const message of ToolManager.getInstance().runTools(assistantMessage.tool_calls)) {
      toolMessages.push(ToolBaseMessageLike(message));
      yield message;
    }

    // 递归调用
    yield* this.stream([...messages,assistantMessage, ...toolMessages], abortController);
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
}
