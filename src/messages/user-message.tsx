import { Context, MessageV2 } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { UserMessageCard } from "@/ui/components/agent-view/messages/message/user-message-card";
import { ModelMessage, UserContent } from "ai";

export class UserMessage implements MessageV2 {
    public content: string;
    public id: string;
    public isStreaming: boolean;
    public role: "user" = "user";
    public context: Context | null;

    constructor(content: string, context: Context | null = null) {
        this.content = content;
        this.id = uuidv4();
        this.isStreaming = false;
        this.role = "user";
        this.context = context
    }
    render(): React.ReactElement {
        return <UserMessageCard id={this.id} content={this.content} images={this.context?.images} />;
    }
    toModelMessage(): ModelMessage {
        const content: UserContent = [
            {
                type: 'text',
                text: this.getEnhancedContext()
            }
        ]

        if (this.context?.images?.length) {
            content.push(...this.context.images.map(image => ({
                type: 'image' as const,
                image
            })));
        }

        return { role: "user", content };
    }

    private getEnhancedContext(): string {
        const info: string[] = [];

        if (this.context?.activeNote) {
            info.push(`Active Note: ${this.context.activeNote.path}`);
        }

        if (this.context?.cursorPosition) {
            const { line, column } = this.context.cursorPosition;
            info.push(`Cursor Position: line ${line}, column ${column}`);
        }

        if (this.context?.recentFiles?.length) {
            const recentPaths = this.context.recentFiles.map(f => f.path).join('\n  - ');
            info.push(`Recent Files:\n  - ${recentPaths}`);
        }

        if (this.context?.recentEdits?.length) {
            const editPaths = this.context.recentEdits.map(f => f.path).join('\n  - ');
            info.push(`Recent Edits:\n  - ${editPaths}`);
        }

        const textContent = info.length > 0
            ? `## Context\n${info.join('\n')}\n\n## User Message\n${this.content}`
            : this.content;

        return textContent
    }
}