import { MessageCard } from "./message-card";

type Props = {
    children?: React.ReactNode;
};

export const ToolMessageCard = ({ children }: Props) => {
    return (
        <MessageCard>
            <div className="tw-whitespace-pre-wrap tw-break-words tw-text-[calc(var(--font-text-size)_-_4px)] tw-font-Thin">
                {children}
            </div>
        </MessageCard>
    );
};