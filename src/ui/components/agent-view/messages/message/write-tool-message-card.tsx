import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import React from "react";
import { ChevronsUpDown, Check, X, FilePlus, FilePen } from "lucide-react";
import DiffMatchPatch from "diff-match-patch";

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
    decision: "apply" | "reject" | null;
    onApply: () => void;
    onReject: () => void;
}

export const WriteToolMessageCard = ({ origin_answered_state, writeResult, decision, onApply, onReject }: Props) => {
    const [isOpen, setIsOpen] = React.useState(!origin_answered_state);
    const [isAnswered, setIsAnswered] = React.useState(origin_answered_state);

    const handleApply = () => {
        setIsOpen(false);
        onApply();
        setIsAnswered(true);
    };

    const handleReject = () => {
        setIsOpen(false);
        onReject();
        setIsAnswered(true);
    };

    const diffLines = React.useMemo(() => {
        if (writeResult.is_new_file) {
            return writeResult.new_content.split('\n').map(line => ({
                type: 'add' as const,
                text: line,
            }));
        }

        if (!writeResult.old_content) {
            return [];
        }

        const dmp = new DiffMatchPatch();
        const oldLines = writeResult.old_content.split('\n');
        const newLines = writeResult.new_content.split('\n');

        const lineDiffs = dmp.diff_linesToChars_(writeResult.old_content, writeResult.new_content);
        const diffs = dmp.diff_main(lineDiffs.chars1, lineDiffs.chars2, false);
        dmp.diff_cleanupSemantic(diffs);
        dmp.diff_charsToLines_(diffs, lineDiffs.lineArray);

        const result: Array<{ type: 'equal' | 'delete' | 'add', text: string }> = [];
        diffs.forEach((diff: [number, string]) => {
            const [op, text] = diff;
            const textLines = text.split('\n');
            textLines.forEach((line: string, index: number) => {
                if (index === textLines.length - 1 && line === '') return;
                if (op === -1) {
                    result.push({ type: 'delete', text: line });
                } else if (op === 1) {
                    result.push({ type: 'add', text: line });
                } else {
                    result.push({ type: 'equal', text: line });
                }
            });
        });
        return result;
    }, [writeResult]);

    const statusText = isAnswered
        ? (decision === "apply" ? "已应用" : decision === "reject" ? "已拒绝" : "已处理")
        : "待确认";

    const fileIcon = writeResult.is_new_file ? <FilePlus className="tw-size-4" /> : <FilePen className="tw-size-4" />;
    const fileStatus = writeResult.is_new_file ? "新建" : "覆盖";

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="tw-w-full tw-rounded-md tw-border tw-border-solid tw-border-border tw-py-1"
        >
            <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-0">
                <div className="tw-flex tw-items-center tw-gap-2">
                    <span>{statusText}:</span>
                    {fileIcon}
                    <span className="tw-font-mono tw-text-sm">{writeResult.file_path}</span>
                    <span className="tw-text-xs tw-text-muted-foreground">({fileStatus})</span>
                </div>
                {isAnswered && (
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                            <ChevronsUpDown className="tw-size-4" />
                        </Button>
                    </CollapsibleTrigger>
                )}
            </div>
            <CollapsibleContent className="tw-flex tw-flex-col tw-w-full tw-px-1">
                {writeResult.is_new_file ? (
                    <div className="tw-w-full tw-mt-2 tw-rounded tw-border tw-border-border tw-overflow-hidden tw-bg-[#f0fff4] dark:tw-bg-[#033a16]">
                        <div className="tw-font-mono tw-text-xs tw-leading-relaxed tw-max-h-96 tw-overflow-y-auto">
                            {writeResult.new_content.split('\n').map((line, index) => (
                                <div key={index} className="tw-flex tw-items-start tw-bg-[#acf2bd] dark:tw-bg-[#0c3228] tw-text-[#116329] dark:tw-text-[#3fb950]">
                                    <span className="tw-select-none tw-px-2 tw-py-0.5 tw-min-w-[2rem] tw-text-center tw-bg-[#acf2bd] dark:tw-bg-[#0c3228]">
                                        +
                                    </span>
                                    <span className="tw-flex-1 tw-py-0.5 tw-pr-2">
                                        {line || '\n'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="tw-w-full tw-mt-2 tw-rounded tw-border tw-border-border tw-overflow-hidden tw-bg-[#f6f8fa] dark:tw-bg-[#0d1117]">
                        <div className="tw-font-mono tw-text-xs tw-leading-relaxed tw-max-h-96 tw-overflow-y-auto">
                            {diffLines.map((diff, index) => {
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
                {!isAnswered && (
                    <div className="tw-flex tw-justify-start tw-gap-2 tw-mt-2 tw-px-2">
                        <Button
                            variant="ghost"
                            size="fit"
                            className="tw-text-green-600 dark:tw-text-green-400 hover:tw-bg-green-50 dark:hover:tw-bg-green-900/20"
                            onClick={handleApply}
                        >
                            <Check className="tw-size-4 tw-mr-1" />
                            应用
                        </Button>
                        <Button
                            variant="ghost"
                            size="fit"
                            className="tw-text-red-600 dark:tw-text-red-400 hover:tw-bg-red-50 dark:hover:tw-bg-red-900/20"
                            onClick={handleReject}
                        >
                            <X className="tw-size-4 tw-mr-1" />
                            拒绝
                        </Button>
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
};
