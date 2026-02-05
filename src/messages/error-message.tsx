import { MessageV2 } from "@/types";
import { v4 as uuidv4 } from 'uuid';
import { ErrorMessageCard } from "@/ui/components/agent-view/messages/message/error-message-card";

export class ErrorMessage implements MessageV2 {
    public content: string;
    public id: string;
    public isStreaming: boolean;
    public role: "error" = "error";
    constructor(content: string) {
        this.content = content;
        this.id = uuidv4();
        this.isStreaming = false;
    }
    render(): React.ReactElement {
        return <ErrorMessageCard content={this.content} />;
    }
}