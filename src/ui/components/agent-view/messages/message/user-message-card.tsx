import { useRef } from "react";
import { RichTextViewer, RichTextViewerRef } from "../../input/RichTextViewer";
import { MessageCard } from "./message-card";

type Props = {
    content: string;
}

export function UserMessageCard({ content }: Props) {
    const viewerRef = useRef<RichTextViewerRef>(null);

    return (
        <MessageCard has_border={true}>
            <RichTextViewer
                ref={viewerRef}
                content={content}
            />
        </MessageCard>
    )
}
