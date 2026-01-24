import { MessageV2 } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { BaseMessageLike } from "@langchain/core/messages";
import { ToolMessageCard } from "@/ui/components/agent-view/messages/message/tool-message-card";
import { ErrorToolMessageCard } from "@/ui/components/agent-view/messages/message/error-tool-message-card";
import { ToolCall } from "@langchain/core/dist/messages/tool";

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

    static fromToolCall(toolCall: ToolCall): ToolMessage {
        return new ToolMessage(toolCall.name, toolCall.id?? "");
    }

    /**
     * 创建错误工具消息
     */
    static createErrorToolMessage(
        toolCall: ToolCall,
        error: string,
        details?: Record<string, any>,
        errorType?: string
    ): ToolMessage {
        const message = new ToolMessage(toolCall.name, toolCall.id ?? "");
        message.isError = true;
        message.content = error;
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
    toBaseMessageLike(): BaseMessageLike {
        if (this.isError) {
            // 错误消息包装为JSON格式，包含错误标记
            return {
                role: "tool",
                content: JSON.stringify({
                    _isError: true,
                    error: this.content,
                    details: this.errorDetails,
                    type: this.errorType
                }),
                name: this.name,
                tool_call_id: this.tool_call_id,
            };
        }
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