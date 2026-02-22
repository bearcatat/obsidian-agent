import { AssistantMessageCard } from "./assistant-message-card";
import { MessageCard } from "./message-card";

type Props = {
    content: string;
    isStreaming: boolean;
};

export const ThinkingMessageCard = ({ content, isStreaming }: Props) => {
    return (
        <MessageCard has_border={false}>
            <details className="tw-flex-col tw-group tw-flex tw-rounded-md tw-p-1 tw-border tw-border-solid tw-border-border" open={isStreaming}>
                <summary className="tw-cursor-pointer tw-text-muted tw-text-xs tw-select-none">💭 Thinking</summary>
                <div className="tw-text-muted tw-p-1 tw-rounded-sm tw-bg-primary tw-max-h-64 tw-overflow-y-auto">
                    <AssistantMessageCard content={content} />
                </div>
            </details>
        </MessageCard>
    );
};