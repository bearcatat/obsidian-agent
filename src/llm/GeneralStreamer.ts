import { AIMessageChunk } from "@langchain/core/messages";
import { ToolCallChunk } from "@langchain/core/dist/messages/tool";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { MessageV2, AgentModel, Streamer, Message } from "@/types";
import { withSuppressedTokenWarnings } from "@/utils";
import { StructuredToolInterface } from "@langchain/core/tools";
import { AssistantMessage } from "@/messages/assistant-message";

export default class GeneralStreamer implements Streamer {
  private model: AgentModel;

  private toolCallChunkMap: Map<number, ToolCallChunk> = new Map();
  private assistantMessage: AssistantMessage = AssistantMessage.createEmpty("");
  private lastSentMessageRole: "assistant" | "none" = "none";


  constructor(model: AgentModel) {
    this.model = model;
  }

  async *stream(
    messages: any,
    tools: StructuredToolInterface[],
    abortController: AbortController,
  ): AsyncGenerator<MessageV2, void> {
    try {
      const streamOptions = this.buildModelOptions(tools, abortController);
      const chatStream = await withSuppressedTokenWarnings(() => {
        return this.model.stream(messages, streamOptions);
      });

      for await (const chunk of chatStream) {
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
  ): Promise<MessageV2> {
    const invokeOptions = this.buildModelOptions(tools, abortController);
    const response = await withSuppressedTokenWarnings(() => {
      return this.model.invoke(messages, invokeOptions);
    });
    return AssistantMessage.fromAIMessageChunk(response);
  }

  private buildModelOptions(tools: StructuredToolInterface[], abortController: AbortController): any {
    const options: any = {
      signal: abortController.signal,
    };
    if (tools && tools.length > 0) {
      options.tools = tools;
      options.tool_choice = "auto";
    }
    return options;
  }

  private async *generateMessage(chunk: AIMessageChunk): AsyncGenerator<MessageV2, void> {
    yield* this.generateContentMessage(chunk);
    this.handleToolCall(chunk);
  }





  async *resetLastSentForContentIfNeeded(chunk: AIMessageChunk): AsyncGenerator<MessageV2, void> {
    if (!chunk.id) {
      return;
    }
    if (!this.assistantMessage.isMatch(chunk)) {
      this.assistantMessage = AssistantMessage.createEmpty(chunk.id);
    }
  }

  private async *generateContentMessage(chunk: AIMessageChunk): AsyncGenerator<MessageV2, void> {
    yield* this.resetLastSentForContentIfNeeded(chunk);
    
    // 处理reasoning_content
    if (chunk.additional_kwargs?.reasoning_content !== undefined && chunk.additional_kwargs?.reasoning_content !== null) {
      this.assistantMessage.appendReasoningContent(chunk.additional_kwargs.reasoning_content as string || "");
    }
    
    // 处理content
    if (typeof chunk.content === "string") {
      this.assistantMessage.appendContent(chunk.content);
    } else if (Array.isArray(chunk.content)) {
      chunk.content.forEach((item) => {
        if (item.type === "text") {
          this.assistantMessage.appendContent(item.text);
        }
      });
    }
    
    yield this.assistantMessage;
    this.lastSentMessageRole = "assistant";
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

  private async *close(): AsyncGenerator<MessageV2, void> {
    this.assistantMessage.close();
    this.setToolCalls();
    yield this.assistantMessage;
    this.lastSentMessageRole = "none";
    this.assistantMessage = AssistantMessage.createEmpty("");
    this.toolCallChunkMap.clear();
  }

  private setToolCalls() {
    this.toolCallChunkMap.forEach((toolCallChunk, index) => {
      const toolCall = this.toolCallChunkToToolCall(toolCallChunk);
      if (toolCall) {
        this.assistantMessage.appendToolCall(toolCall);
      }
    });
  }

  private toolCallChunkToToolCall(toolCallChunk: ToolCallChunk): ToolCall | undefined {
    if (!toolCallChunk.args || !toolCallChunk.name || !toolCallChunk.id) {
      return undefined;
    }
    try {
      return {
        name: toolCallChunk.name,
        args: JSON.parse(toolCallChunk.args),
        id: toolCallChunk.id,
        type: "tool_call",
      };
    } catch (error) {
      console.error("Failed to parse tool call args:", error, "args:", toolCallChunk.args);
      return undefined;
    }
  }
}
