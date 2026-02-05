import { MessageV2 } from "@/types";
import { AssistantMessageCard } from "@/ui/components/agent-view/messages/message/assistant-message-card";

export class AssistantMessage implements MessageV2 {
    public content: string;
    public reasoning_content: string;
    public id: string;
    public isStreaming: boolean;
    public role: "assistant" = "assistant";

    private constructor(content: string, reasoning_content: string, isStreaming: boolean, id: string) {
        this.content = content;
        this.reasoning_content = reasoning_content;
        this.id = id + "-assistant";
        this.isStreaming = isStreaming;
    }
    static createEmpty(id: string): AssistantMessage {
        return new AssistantMessage("", "", true, id);
    }
    render(): React.ReactElement {
        return <AssistantMessageCard content={this.content} reasoning_content={this.reasoning_content} isStreaming={this.isStreaming} />;
    }
    appendContent(content: string): void {
        this.content += content || "";
    }
    appendReasoningContent(content: string): void {
        this.reasoning_content += content || "";
    }
    close(): void {
        this.isStreaming = false;
    }
}