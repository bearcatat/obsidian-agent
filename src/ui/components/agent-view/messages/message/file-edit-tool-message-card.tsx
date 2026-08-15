import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import React from "react";
import { FileEdit, FileReviewStatus } from "@/types";
import { useAgentStore } from "@/state/agent-state-impl";
import { ChevronsUpDown } from "lucide-react";
import { buildHunkPreviewRows, buildLineDiff } from "./diff-preview-utils";
import { DiffView } from "./diff-view";
import { t } from "../../../../../i18n";

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
        return t('agent:rejected');
    }
    if (reviewStatus === "reviewing") {
        return t('agent:reviewing');
    }
    if (reviewStatus === "reviewed") {
        return t('agent:reviewed');
    }
    if (reviewStatus === "conflicted") {
        return t('common:conflict');
    }
    if (reviewStatus) {
        return t('agent:needsSync');
    }
    if (decision === "reject") {
        return t('agent:rejected');
    }
    if (decision === "apply") {
        return t('agent:reviewed');
    }
    return origin_answered_state ? t('agent:reviewed') : t('agent:reviewing');
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
        if (effectiveStatusText === t('agent:reviewing')) {
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
                <DiffView diffRows={diffRows} />
            </CollapsibleContent>
        </Collapsible>
    );
};
