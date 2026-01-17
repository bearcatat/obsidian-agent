import { MessageV2 } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { BaseMessageLike } from "@langchain/core/messages";
import { ToolMessageCard } from "@/ui/components/agent-view/messages/message/tool-message-card";
import { ToolCall } from "@langchain/core/dist/messages/tool";

export class ToolMessage implements MessageV2 {
    public id: string;
    public isStreaming: boolean;
    public name: string;
    public tool_call_id: string;
    public content: string;
    public role: "tool" = "tool";
    public isCustomized: boolean;
    private children: React.ReactNode;
    private constructor(name: string, tool_call_id: string) {
        this.id = uuidv4();
        this.isStreaming = true;
        this.name = name;
        this.tool_call_id = tool_call_id;
        this.content = "";
        this.isCustomized = false;
    }

    static fromToolCall(toolCall: ToolCall): ToolMessage {
        return new ToolMessage(toolCall.name, toolCall.id?? "");
    }
    render(): React.ReactElement {
        return (
            <ToolMessageCard>{this.children}</ToolMessageCard>
        )
    }
    toBaseMessageLike(): BaseMessageLike {
        return {
            role: "tool",
            content: this.content,
            name: this.name,
            tool_call_id: this.tool_call_id,
        }
    }

    setContent(content: string): void {
        this.content = content;
    }
    setChildren(children: React.ReactNode): void {
        this.children = children;
    }
    close(): void {
        this.isStreaming = false;
    }
}