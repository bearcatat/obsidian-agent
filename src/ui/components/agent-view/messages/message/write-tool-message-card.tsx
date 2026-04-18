import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import React from "react";
import { FileReviewStatus } from "@/types";
import { useAgentStore } from "@/state/agent-state-impl";
import { ChevronsUpDown, FilePlus, FilePen } from "lucide-react";
import { buildHunkPreviewRows, buildLineDiff } from "./diff-preview-utils";

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
            return writeResult.new_content.split("\n").map((line) => ({
                type: "line" as const,
                line: {
                    type: "add" as const,
                    text: line,
                },
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
                {writeResult.is_new_file ? (
                    <div className="tw-w-full tw-mt-2 tw-rounded tw-border tw-border-border tw-overflow-hidden tw-bg-[#f0fff4] dark:tw-bg-[#033a16]">
                        <div className="tw-font-mono tw-text-xs tw-leading-relaxed tw-max-h-48 tw-overflow-y-auto">
                            {writeResult.new_content.split('\n').map((line, index) => (
                                <div key={index} className="tw-flex tw-items-start tw-bg-[#acf2bd] dark:tw-bg-[#0c3228] tw-text-[#116329] dark:tw-text-[#3fb950]">
                                    <span className="tw-select-none tw-px-2 tw-py-0.5 tw-min-w-[2rem] tw-text-center tw-bg-[#acf2bd] dark:tw-bg-[#0c3228]">
                                        +
                                    </span>
                                    <span className="tw-flex-1 tw-py-0.5 tw-pr-2 tw-whitespace-pre">
                                        {line || '\n'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
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
                                const isDelete = diff.type === 'delete';
                                const isAdd = diff.type === 'add';
                                const isEqual = diff.type === 'equal';

                                const bgColor = isDelete
                                    ? 'tw-bg-[#fff5f5] dark:tw-bg-[#490202]'
                                    : isAdd
                                        ? 'tw-bg-[#f0fff4] dark:tw-bg-[#033a16]'
                                        : 'tw-bg-transparent';

                                const borderColor = isDelete
                                    ? 'tw-border-l-2 tw-border-l-[#fa4549] dark:tw-border-l-[#f85149]'
                                    : isAdd
                                        ? 'tw-border-l-2 tw-border-l-[#3fb950] dark:tw-border-l-[#3fb950]'
                                        : '';

                                const prefix = isDelete ? '-' : isAdd ? '+' : ' ';
                                const prefixBg = isDelete
                                    ? 'tw-bg-[#ffd7d9] dark:tw-bg-[#67060c] tw-text-[#82071e] dark:tw-text-[#ffa198]'
                                    : isAdd
                                        ? 'tw-bg-[#acf2bd] dark:tw-bg-[#0c3228] tw-text-[#116329] dark:tw-text-[#3fb950]'
                                        : 'tw-bg-transparent tw-text-muted-foreground';

                                const textColor = isDelete
                                    ? 'tw-text-[#82071e] dark:tw-text-[#ffa198]'
                                    : isAdd
                                        ? 'tw-text-[#116329] dark:tw-text-[#3fb950]'
                                        : '';

                                return (
                                    <div key={index} className={`tw-flex tw-items-start ${bgColor} ${borderColor} ${textColor}`}>
                                        <span className={`tw-select-none tw-px-2 tw-py-0.5 tw-min-w-[2rem] tw-text-center ${prefixBg}`}>
                                            {prefix}
                                        </span>
                                        <span className={`tw-flex-1 tw-py-0.5 tw-pr-2 tw-whitespace-pre ${textColor || 'tw-text-foreground'}`}>
                                            {diff.text || '\n'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
};
