import { MessageCard } from "./message-card";

type Props = {
    content: string;
}

export function UserMessageCard({ content }: Props) {
    return (
        <MessageCard has_border={true}>
            <div className="tw-whitespace-pre-wrap tw-break-words tw-text-[calc(var(--font-text-size)_-_2px)] tw-font-normal">
                {content}
            </div>
        </MessageCard>
    )
}