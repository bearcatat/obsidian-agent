import { MessageV2 } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { ToolMessageCard } from "@/ui/components/agent-view/messages/message/tool-message-card";
import { ErrorToolMessageCard } from "@/ui/components/agent-view/messages/message/error-tool-message-card";

export class ToolMessage implements MessageV2 {
    public id: string;
    public isStreaming: boolean;
    public name: string;
    public tool_call_id: string;
    public content: string;
    public role: "tool" = "tool";
    public isCustomized: boolean;

    // 错误相关字段
    public isError: boolean = false;
    public errorCode?: string;
    public errorDetails?: Record<string, any>;
    public errorType?: string;

    private children: React.ReactNode;
    private constructor(name: string, tool_call_id: string) {
        this.id = uuidv4();
        this.isStreaming = true;
        this.name = name;
        this.tool_call_id = tool_call_id;
        this.content = "";
        this.isCustomized = false;
    }

    static from(name: string, id: string): ToolMessage {
        return new ToolMessage(name, id)
    }

    static createErrorToolMessage2(
        name: string,
        id: string,
        error: unknown,
        details?: Record<string, any>,
        errorType?: string
    ): ToolMessage {
        const message = new ToolMessage(name, id ?? "");
        message.isError = true;
        message.content = error instanceof Error ? error.message : String(error);
        message.errorDetails = details;
        message.errorType = errorType || "runtime";
        message.close(); // 错误消息立即关闭流式状态
        return message;
    }

    render(): React.ReactElement {
        if (this.isError) {
            return (
                <ErrorToolMessageCard
                    content={this.content}
                    errorDetails={this.errorDetails}
                    errorType={this.errorType}
                />
            );
        }
        return (
            <ToolMessageCard>{this.children}</ToolMessageCard>
        )
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