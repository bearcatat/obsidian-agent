import { useRef } from "react";
import { RichTextViewer, RichTextViewerRef } from "../../input/RichTextViewer";
import { MessageCard } from "./message-card";
import { UserContext } from "../../input/context";

type Props = {
    content: string;
    images?: string[];
}

export function UserMessageCard({ content, images }: Props) {
    const viewerRef = useRef<RichTextViewerRef>(null);

    return (
        <MessageCard has_border={true}>
            {images && images.length > 0 && (
                <UserContext context={{ images }} />
            )}
            <RichTextViewer
                ref={viewerRef}
                content={content}
            />
        </MessageCard>
    )
}
