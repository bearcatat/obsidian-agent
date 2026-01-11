import { MessageV2 } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { BaseMessageLike } from "@langchain/core/messages";
import { UserMessageCard } from "@/ui/components/agent-view/messages/message/user-message-card";

export class UserMessage implements MessageV2 {
    public content: string;
    public id: string;
    public isStreaming: boolean;
    public role: "user" = "user";

    constructor(content: string) {
        this.content = content;
        this.id = uuidv4();
        this.isStreaming = false;
        this.role = "user";
    }
    render(): React.ReactElement {
        return <UserMessageCard content={this.content} />;
    }
    toBaseMessageLike(): BaseMessageLike {
        return {
            role: "user",
            content: this.content,
        }
    }
}