import { MessageCard } from "./message-card";

type Props = {
    content: string;
};

export const ErrorMessageCard = ({ content }: Props) => {
    return (
        <MessageCard has_border={true}>
            <div className="tw-text-error">❌{content}</div>
        </MessageCard>
    );
};