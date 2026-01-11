import { MessageV2 } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { BaseMessageLike } from "@langchain/core/messages";
import { ThinkingMessageCard } from "@/ui/components/agent-view/messages/message/thinking-message-card";
import { AIMessageChunk } from "@langchain/core/dist/messages/ai";

export class ThinkingMessage implements MessageV2 {
    public content: string;
    public id: string;
    public isStreaming: boolean;
    public role: "thinking" = "thinking";

    private constructor(content: string, isStreaming: boolean, id: string) {
        this.id = id+"-thinking";
        this.content = content;
        this.isStreaming = isStreaming;
    }
    static createEmpty(id: string): ThinkingMessage {
        return new ThinkingMessage("", true, id);
    }
    render(): React.ReactElement {
        return <ThinkingMessageCard content={this.content} isStreaming={this.isStreaming} />;
    }
    toBaseMessageLike(): undefined {
        return undefined;
    }
    isMatch(chunk: AIMessageChunk): boolean {
        if (!chunk.id) {
            return false;
        }
        return chunk.id+"-thinking" === this.id;
    }
    appendContent(content: string): void {
        this.content += content || "";
    }
    close(): void {
        this.isStreaming = false;
    }
}