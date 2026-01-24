import { MessageV2 } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { BaseMessageLike } from "@langchain/core/messages";
import { AssistantMessageCard } from "@/ui/components/agent-view/messages/message/assistant-message-card";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { AIMessageChunk } from "@langchain/core/dist/messages/ai";

export class AssistantMessage implements MessageV2 {
    public content: string;
    public reasoning_content: string;
    public id: string;
    public isStreaming: boolean;
    public tool_calls: ToolCall[];
    public role: "assistant" = "assistant";

    private constructor(content: string, reasoning_content: string, tool_calls: ToolCall[], isStreaming: boolean, id: string) {
        this.content = content;
        this.reasoning_content = reasoning_content;
        this.id = id+"-assistant";
        this.isStreaming = isStreaming;
        this.tool_calls = tool_calls;
    }

    static fromAIMessageChunk(chunk: AIMessageChunk): AssistantMessage {
        const content = typeof chunk.content === "string"
            ? chunk.content
            : chunk.content.toString();
        const reasoning_content = chunk.additional_kwargs?.reasoning_content as string || "";
        const tool_calls = chunk.tool_calls || [];
        return new AssistantMessage(content, reasoning_content, tool_calls, false, chunk.id?? "");
    }
    static createEmpty(id: string): AssistantMessage {
        return new AssistantMessage("", "", [], true, id);
    }

    render(): React.ReactElement {
        return <AssistantMessageCard content={this.content} reasoning_content={this.reasoning_content} isStreaming={this.isStreaming} />;
    }
    toBaseMessageLike(): BaseMessageLike {
        const result: any = {
            role: "assistant",
            content: this.content,
            tool_calls: this.tool_calls,
        };
        // 确保reasoning_content字段始终存在，即使为空字符串
        result.reasoning_content = this.reasoning_content || "";
        return result;
    }

    isMatch(chunk: AIMessageChunk): boolean {
        if (!chunk.id) {
            return false;
        }
        return chunk.id+"-assistant" === this.id;
    }
    appendContent(content: string): void {
        this.content += content || "";
    }
    appendReasoningContent(content: string): void {
        this.reasoning_content += content || "";
    }
    appendToolCall(tool_call: ToolCall): void {
        this.tool_calls.push(tool_call);
    }
    close(): void {
        this.isStreaming = false;
    }
}