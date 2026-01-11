import { MessageV2 } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { BaseMessageLike } from "@langchain/core/messages";
import { AssistantMessageCard } from "@/ui/components/agent-view/messages/message/assistant-message-card";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { AIMessageChunk } from "@langchain/core/dist/messages/ai";

export class AssistantMessage implements MessageV2 {
    public content: string;
    public id: string;
    public isStreaming: boolean;
    public tool_calls: ToolCall[];
    public role: "assistant" = "assistant";

    private constructor(content: string, tool_calls: ToolCall[], isStreaming: boolean, id: string) {
        this.content = content;
        this.id = id+"-assistant";
        this.isStreaming = isStreaming;
        this.tool_calls = tool_calls;
    }

    static fromAIMessageChunk(chunk: AIMessageChunk): AssistantMessage {
        const content = typeof chunk.content === "string"
            ? chunk.content
            : chunk.content.toString();
        const tool_calls = chunk.tool_calls || [];
        return new AssistantMessage(content, tool_calls, false, chunk.id?? "");
    }
    static createEmpty(id: string): AssistantMessage {
        return new AssistantMessage("", [], true, id);
    }

    render(): React.ReactElement {
        return <AssistantMessageCard content={this.content} />;
    }
    toBaseMessageLike(): BaseMessageLike {
        return {
            role: "assistant",
            content: this.content,
            tool_calls: this.tool_calls,
        }
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
    appendToolCall(tool_call: ToolCall): void {
        this.tool_calls.push(tool_call);
    }
    close(): void {
        this.isStreaming = false;
    }
}