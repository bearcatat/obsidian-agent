import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import React from "react";
import { FileEdit, FileReviewStatus } from "@/types";
import { useAgentStore } from "@/state/agent-state-impl";
import { ChevronsUpDown } from "lucide-react";
import { buildHunkPreviewRows, buildLineDiff } from "./diff-preview-utils";

type Props = {
    origin_answered_state: boolean;
    fileEdit: FileEdit;
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

export const FileEditToolMessageCard = ({ origin_answered_state, fileEdit, decision, reviewStatus, isReverted }: Props) => {
    const [isOpen, setIsOpen] = React.useState(!origin_answered_state);
    const liveReview = useAgentStore((state) => state.fileReviews.find((review) => review.filePath === fileEdit.file_path));
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
        const oldText = fileEdit.old_content ?? fileEdit.old_string ?? "";
        const newText = fileEdit.new_content ?? fileEdit.new_string ?? "";

        if (!oldText && !newText) {
            return [];
        }

        const lineDiff = buildLineDiff(oldText, newText);
        return buildHunkPreviewRows(lineDiff, 2);
    }, [fileEdit]);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="tw-w-full tw-rounded-md tw-border tw-border-solid tw-border-border tw-py-1"
        >
            <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-0">
                <div className="tw-flex tw-items-center tw-gap-2">
                    <span>{effectiveStatusText}:</span>
                    <span className="tw-font-mono tw-text-sm">{fileEdit.file_path}</span>
                </div>
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                        <ChevronsUpDown className="tw-size-4" />
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="tw-flex tw-flex-col tw-w-full tw-px-1">
                {/* Diff 可视化 - GitHub 风格 */}
                <div className="tw-w-full tw-mt-2 tw-rounded tw-border tw-border-border tw-overflow-hidden tw-bg-[#f6f8fa] dark:tw-bg-[#0d1117]">
                    <div className="tw-font-mono tw-text-xs tw-leading-relaxed tw-max-h-48 tw-overflow-y-auto">
                        {diffRows.length === 0 ? (
                            <div className="tw-px-2 tw-py-1 tw-text-muted-foreground">No changes</div>
                        ) : diffRows.map((row, index) => {
                            if (row.type === "ellipsis") {
                                return (
                                    <div key={index} className="tw-flex tw-items-center tw-px-2 tw-py-0.5 tw-bg-transparent tw-text-muted-foreground">
                                        <span className="tw-font-mono tw-text-xs">...</span>
                                    </div>
                                );
                            }

                            const diff = row.line;
                            const isDelete = diff.type === "delete";
                            const isAdd = diff.type === "add";
                            const isEqual = diff.type === "equal";

                            const bgColor = isDelete
                                ? "tw-bg-[#fff5f5] dark:tw-bg-[#490202]"
                                : isAdd
                                    ? "tw-bg-[#f0fff4] dark:tw-bg-[#033a16]"
                                    : "tw-bg-transparent";

                            const borderColor = isDelete
                                ? "tw-border-l-2 tw-border-l-[#fa4549] dark:tw-border-l-[#f85149]"
                                : isAdd
                                    ? "tw-border-l-2 tw-border-l-[#3fb950] dark:tw-border-l-[#3fb950]"
                                    : "";

                            const prefix = isDelete ? "-" : isAdd ? "+" : " ";
                            const prefixBg = isDelete
                                ? "tw-bg-[#ffd7d9] dark:tw-bg-[#67060c] tw-text-[#82071e] dark:tw-text-[#ffa198]"
                                : isAdd
                                    ? "tw-bg-[#acf2bd] dark:tw-bg-[#0c3228] tw-text-[#116329] dark:tw-text-[#3fb950]"
                                    : "tw-bg-transparent tw-text-muted-foreground";

                            const textColor = isDelete
                                ? "tw-text-[#82071e] dark:tw-text-[#ffa198]"
                                : isAdd
                                    ? "tw-text-[#116329] dark:tw-text-[#3fb950]"
                                    : "";

                            return (
                                <div key={index} className={`tw-flex tw-items-start ${bgColor} ${borderColor} ${textColor}`}>
                                    <span className={`tw-select-none tw-px-2 tw-py-0.5 tw-min-w-[2rem] tw-text-center ${prefixBg}`}>
                                        {prefix}
                                    </span>
                                    <span className={`tw-flex-1 tw-py-0.5 tw-pr-2 tw-whitespace-pre ${textColor || "tw-text-foreground"}`}>
                                        {diff.text || "\n"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};
