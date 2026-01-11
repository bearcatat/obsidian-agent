import { AssistantMessageCard } from "./assistant-message-card";
import { MessageCard } from "./message-card";

type Props = {
    content: string;
    isStreaming: boolean;
};

export const ThinkingMessageCard = ({ content, isStreaming }: Props) => {
    return (
        <MessageCard has_border={true}>
            <details className="tw-group tw-mx-1 tw-flex tw-gap-1 tw-rounded-md tw-p-1 tw-border tw-border-solid tw-border-border" open={isStreaming}>
                <summary className="tw-cursor-pointer tw-text-muted tw-text-xs tw-mb-1 tw-select-none">💭 Thinking</summary>
                <div className="tw-text-muted tw-mt-1 tw-p-1 tw-rounded-sm tw-bg-primary">
                    <AssistantMessageCard content={content} />
                </div>
            </details>
        </MessageCard>
    );
};