import { AIMessageChunk } from "@langchain/core/messages";
import { ToolCallChunk } from "@langchain/core/dist/messages/tool";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { Message, AgentModel, Streamer } from "@/types";
import { withSuppressedTokenWarnings } from "@/utils";
import { StructuredToolInterface } from "@langchain/core/tools";

export default class GeneralStreamer implements Streamer {
  private model: AgentModel;
  private lastSent: Message = {
    id: "",
    role: "none",
    content: "",
    tool_calls: [],
    isStreaming: true,
  };
  private toolCallChunkMap: Map<number, ToolCallChunk> = new Map();

  constructor(model: AgentModel) {
    this.model = model;
  }

  async *stream(
    messages: any,
    tools: StructuredToolInterface[],
    abortController: AbortController,
  ): AsyncGenerator<Message, void> {
    try {
      const streamOptions: any = {
        signal: abortController.signal,
      };
      
      // 只有当有工具时才设置 tools 和 tool_choice
      if (tools && tools.length > 0) {
        streamOptions.tools = tools;
        streamOptions.tool_choice = "auto";
      }

      const chatStream = await withSuppressedTokenWarnings(() => {
        return this.model.stream(messages, streamOptions);
      });
      for await (const chunk of chatStream) {
        console.log("chunk", chunk);
        yield* this.generateMessage(chunk);
      }
    } catch (error) {
      console.error("Error in stream", error);
    } finally {
      yield* this.close();
    }
  }

  // invoke
  async invoke(
    messages: any,
    tools: StructuredToolInterface[],
    abortController: AbortController,
  ): Promise<Message> {
    const invokeOptions: any = {
      signal: abortController.signal,
    };
    
    // 只有当有工具时才设置 tools 和 tool_choice
    if (tools && tools.length > 0) {
      invokeOptions.tools = tools;
      invokeOptions.tool_choice = "auto";
    }

    const response = await withSuppressedTokenWarnings(() => {
      return this.model.invoke(messages, invokeOptions);
    });

    return {
      id: response.id || `invoke-${Date.now()}`,
      role: "assistant",
      content: typeof response.content === "string"
        ? response.content
        : response.content.toString(),
      tool_calls: response.tool_calls || [],
      isStreaming: false,
    };
  }

  private async *generateMessage(chunk: AIMessageChunk): AsyncGenerator<Message, void> {
    if (this.isThinkingChunk(chunk)) {
      yield* this.generateThinkingMessage(chunk);
    } else if (this.isContentChunk(chunk)) {
      yield* this.generateContentMessage(chunk);
    }
    this.handleToolCall(chunk);
  }

  private isThinkingChunk(chunk: AIMessageChunk): boolean {
    return chunk.additional_kwargs?.reasoning_content !== undefined && chunk.additional_kwargs?.reasoning_content !== null;
  }

  private resetLastSentForThinking(chunk: AIMessageChunk) {
    if (!chunk.id) {
      return;
    }
    if (this.lastSent.role != "thinking") {
      this.lastSent = {
        id: chunk.id + "-thinking",
        role: "thinking",
        content: "",
        tool_calls: [],
        isStreaming: true,
      }
    }
  }

  private async *generateThinkingMessage(chunk: AIMessageChunk): AsyncGenerator<Message, void> {
    this.resetLastSentForThinking(chunk);
    this.lastSent.content += chunk.additional_kwargs?.reasoning_content;
    yield { ...this.lastSent };
  }

  private isContentChunk(chunk: AIMessageChunk): boolean {
    return chunk.content !== undefined && chunk.content !== null;
  }

  async *resetLastSentForContent(chunk: AIMessageChunk): AsyncGenerator<Message, void> {
    if (!chunk.id) {
      return;
    }
    if (this.lastSent.role == "assistant") {
      return;
    }
    if (this.lastSent.role == "thinking") {
      this.lastSent.isStreaming = false;
      yield { ...this.lastSent };
    }
    this.lastSent = {
      id: chunk.id,
      role: "assistant",
      content: "",
      tool_calls: [],
      isStreaming: true,
    }
  }

  private async *generateContentMessage(chunk: AIMessageChunk): AsyncGenerator<Message, void> {
    yield* this.resetLastSentForContent(chunk);
    if (typeof chunk.content === "string") {
      this.lastSent.content += chunk.content;
    } else if (Array.isArray(chunk.content)) {
      chunk.content.forEach((item) => {
        if (item.type === "text") {
          this.lastSent.content += item.text;
        }
      });
    }
    yield { ...this.lastSent };
  }

  private handleToolCall(chunk: AIMessageChunk) {
    const toolCallChunks = chunk.tool_call_chunks;
    // console.log("toolCallChunks", toolCallChunks);
    if (!toolCallChunks) {
      return;
    }
    for (const toolCallChunk of toolCallChunks) {
      this.handleToolCallChunk(toolCallChunk);
    }
  }

  private handleToolCallChunk(chunk: ToolCallChunk) {
    if (chunk.index === undefined) {
      return;
    }
    // check tool call chunk is exist in toolCallChunkMap
    const toolCallChunk = this.toolCallChunkMap.get(chunk.index);
    if (!toolCallChunk) {
      this.toolCallChunkMap.set(chunk.index, chunk);
      return;
    }
    // console.log("merge chunk", chunk);
    // merge tool call chunk
    if (chunk.args) {
      toolCallChunk.args += chunk.args;
    }
    if (chunk.name) {
      toolCallChunk.name += chunk.name;
    }
    if (chunk.id) {
      toolCallChunk.id += chunk.id;
    }
  }

  private async *close(): AsyncGenerator<Message, void> {
    this.lastSent.isStreaming = false;
    this.setToolCalls();
    yield { ...this.lastSent };
    this.lastSent = {
      id: "",
      role: "none",
      content: "",
      tool_calls: [],
      isStreaming: true,
    }
    this.toolCallChunkMap.clear();
  }

  private setToolCalls() {
    const toolCalls: ToolCall[] = [];
    this.toolCallChunkMap.forEach((toolCallChunk, index) => {
      const toolCall = this.toolCallChunkToToolCall(toolCallChunk);
      if (toolCall) {
        toolCalls.push(toolCall);
      }
    });
    this.lastSent.tool_calls = [...toolCalls];
  }

  private toolCallChunkToToolCall(toolCallChunk: ToolCallChunk): ToolCall | undefined {
    if (!toolCallChunk.args || !toolCallChunk.name || !toolCallChunk.id) {
      return undefined;
    }
    return {
      name: toolCallChunk.name,
      args: JSON.parse(toolCallChunk.args),
      id: toolCallChunk.id,
      type: "tool_call",
    };
  }
}
