import { useRef } from "react";
import { RichTextViewer, RichTextViewerRef } from "../../input/RichTextViewer";
import { UserContext } from "../../input/context";
import { Button } from "@/ui/elements/button";
import { Undo2 } from "lucide-react";
import { useAgentStore } from "@/state/agent-state-impl";
import { InputEditorState } from "@/state/input-editor-state";

type Props = {
    id: string;
    content: string;
    images?: string[];
}

export function UserMessageCard({ id, content, images }: Props) {
    const viewerRef = useRef<RichTextViewerRef>(null);
    const undoToMessage = useAgentStore((state) => state.undoToMessage);

    const handleUndo = () => {
        undoToMessage(id);
        InputEditorState.getInstance().setText(content);
    };

    return (
        <div className="tw-flex tw-w-full tw-flex-col tw-group tw-rounded-md tw-border tw-border-solid tw-border-border tw-p-1 tw-relative" >
            {images && images.length > 0 && (
                <UserContext context={{ images }} />
            )}
            <RichTextViewer
                ref={viewerRef}
                content={content}
            />
            <div className="tw-absolute tw-bottom-1 tw-right-1 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="tw-h-6 tw-w-6" 
                    onClick={handleUndo}
                    title="Edit & Retry"
                >
                    <Undo2 className="tw-h-3 tw-w-3" />
                </Button>
            </div>
        </div>
    )
}
