import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import React from "react";
import { FileReviewStatus } from "@/types";
import { useAgentStore } from "@/state/agent-state-impl";
import { ChevronsUpDown, FilePlus, FilePen } from "lucide-react";
import { buildHunkPreviewRows, buildLineDiff } from "./diff-preview-utils";
import { DiffView } from "./diff-view";

type WriteResult = {
    file_path: string
    old_content?: string
    new_content: string
    is_new_file: boolean
    diff: string
}

type Props = {
    origin_answered_state: boolean;
    writeResult: WriteResult;
    decision?: "apply" | "reject" | null;
    reviewStatus?: FileReviewStatus;
    isReverted?: boolean;
}

function getStatusText(
    reviewStatus?: string,
    isReverted?: boolean,
    decision?: "apply" | "reject" | null,
    origin_answered_state?: boolean,
): string {
    if (isReverted) {
        return "Rejected";
    }
    if (reviewStatus === "reviewing") {
        return "Reviewing";
    }
    if (reviewStatus === "reviewed") {
        return "Reviewed";
    }
    if (reviewStatus) {
        return "Needs sync";
    }
    if (decision === "reject") {
        return "Rejected";
    }
    if (decision === "apply") {
        return "Reviewed";
    }
    return origin_answered_state ? "Reviewed" : "Reviewing";
}

export const WriteToolMessageCard = ({ origin_answered_state, writeResult, decision, reviewStatus, isReverted }: Props) => {
    const [isOpen, setIsOpen] = React.useState(!origin_answered_state);
    const liveReview = useAgentStore((state) => state.fileReviews.find((review) => review.filePath === writeResult.file_path));
    const effectiveStatusText = getStatusText(
        liveReview?.status ?? reviewStatus,
        liveReview?.isReverted ?? isReverted,
        decision,
        origin_answered_state,
    );

    React.useEffect(() => {
        if (effectiveStatusText === "Reviewing") {
            setIsOpen(true);
        }
    }, [effectiveStatusText]);

    const diffRows = React.useMemo(() => {
        if (writeResult.is_new_file) {
            return writeResult.new_content.split("\n").map((line, index) => ({
                type: "line" as const,
                line: {
                    type: "add" as const,
                    text: line,
                },
                newLineNum: index + 1,
            }));
        }

        const oldText = writeResult.old_content ?? "";
        const newText = writeResult.new_content ?? "";

        if (!oldText && !newText) {
            return [];
        }

        return buildHunkPreviewRows(buildLineDiff(oldText, newText), 2);
    }, [writeResult]);

    const fileIcon = writeResult.is_new_file ? <FilePlus className="tw-size-4" /> : <FilePen className="tw-size-4" />;
    const fileStatus = writeResult.is_new_file ? "New" : "Overwrite";

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="tw-w-full tw-rounded-md tw-border tw-border-solid tw-border-border tw-py-1"
        >
            <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-0">
                <div className="tw-flex tw-items-center tw-gap-2">
                    <span>{effectiveStatusText}:</span>
                    {fileIcon}
                    <span className="tw-font-mono tw-text-sm">{writeResult.file_path}</span>
                    <span className="tw-text-xs tw-text-muted-foreground">({fileStatus})</span>
                </div>
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                        <ChevronsUpDown className="tw-size-4" />
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="tw-flex tw-flex-col tw-w-full tw-px-1">
                <DiffView diffRows={diffRows} />
            </CollapsibleContent>
        </Collapsible>
    );
};
