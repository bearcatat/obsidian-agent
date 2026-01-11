import { MessageCard } from "./message-card";

type Props = {
    children?: React.ReactNode;
};

export const ToolMessageCard = ({ children }: Props) => {
    return (
        <MessageCard has_border={true}>
            <div className="tw-whitespace-pre-wrap tw-break-words tw-text-[calc(var(--font-text-size)_-_2px)] tw-font-normal">
                {children}
            </div>
        </MessageCard>
    );
};