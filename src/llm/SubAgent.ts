import { LangChainAssistantMessage, LangChainToolMessage, Message, Streamer } from "@/types";
import AgentMemoryManager from "./AgentMemoryManager";
import { BaseMessageLike } from "@langchain/core/messages";
import { AssistantBaseMessageLike, ErrorMessage, ToolBaseMessageLike } from "@/utils";
import ToolManager from "@/tools/ToolManager";
import { StructuredToolInterface } from "@langchain/core/tools";
import { AgentState } from "@/state/agent-state-impl";
import { getSubAgentSystemPrompt } from "./system-prompts";

export default class SubAgent {
  private model: Streamer;
  private tools: StructuredToolInterface[];
  private memoryManager: AgentMemoryManager;

  public name: string;
  public systemPrompt: string;
  public description: string;


  constructor(name: string, systemPrompt: string, description: string, model: Streamer) {
    this.systemPrompt = systemPrompt;
    this.description = description;
    this.model = model;
    this.memoryManager = new AgentMemoryManager();
    this.name = name;
  }

  async *query(message: Message): AsyncGenerator<Message, void> {
    this.memoryManager.appendMessage(message);
    message.is_sub_agent = true;
    yield message;
    const chatHistory = this.memoryManager.getMessages();
    const systemMessage = { role: "system", content: this.systemPrompt } as BaseMessageLike;
    const sharedSystemMessage = { role: "system", content: getSubAgentSystemPrompt() } as BaseMessageLike;
    const messages = [sharedSystemMessage, systemMessage, ...chatHistory];
    const abortController = AgentState.getInstance().abortController;
    if (!abortController) {
      throw new Error("Abort controller not found");
    }
    for await (const message of this.stream(messages, abortController)) {
      if (!message.isStreaming) {
        this.memoryManager.appendMessage(message);
      }
      message.is_sub_agent = true;
      yield message;
    }
    console.log("SubAgent.query", systemMessage, this.memoryManager.getMessages());
  }

  private async *stream(messages: BaseMessageLike[], abortController: AbortController): AsyncGenerator<Message, void> {
    let assistantMessage: LangChainAssistantMessage | null = null;
    console.log("SubAgent.stream", this.name, messages);
    for await (const message of this.model.stream(messages, this.tools, abortController)) {
      assistantMessage = AssistantBaseMessageLike(message);
      yield message;
    }
    if (!assistantMessage) {
      yield ErrorMessage("Error: No assistant message");
      return;
    }
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return;
    }
    const toolMessages: LangChainToolMessage[] = [];
    for await (const message of ToolManager.getInstance().runTools(assistantMessage.tool_calls)) {
      if (!message.is_sub_agent) {
        toolMessages.push(ToolBaseMessageLike(message));
      }
      yield message;
    }
    yield* this.stream([...messages, assistantMessage, ...toolMessages], abortController);
  }

  async clearMemory(): Promise<void> {
    await this.memoryManager.clearMessages();
  }

  setTools(tools: StructuredToolInterface[]): void {
    this.tools = tools;
  }
}