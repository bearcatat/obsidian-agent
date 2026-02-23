import { useRef } from "react";
import { RichTextViewer, RichTextViewerRef } from "../../input/RichTextViewer";
import { UserContext } from "../../input/context";

type Props = {
    content: string;
    images?: string[];
}

export function UserMessageCard({ content, images }: Props) {
    const viewerRef = useRef<RichTextViewerRef>(null);

    return (
        <div className="tw-flex tw-w-full tw-flex-col tw-group tw-rounded-md tw-border tw-border-solid tw-border-border tw-p-1" >
            {images && images.length > 0 && (
                <UserContext context={{ images }} />
            )}
            <RichTextViewer
                ref={viewerRef}
                content={content}
            />
        </div>
    )
}
