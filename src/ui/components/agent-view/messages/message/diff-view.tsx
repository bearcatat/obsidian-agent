import React from "react";
import { computeLineNumWidth, DiffPreviewRow } from "./diff-preview-utils";

type Props = {
    diffRows: DiffPreviewRow[];
};

export const DiffView = ({ diffRows }: Props) => {
    const lineNumWidth = React.useMemo(() => {
        const maxLine = diffRows.reduce((max, row) => {
            if (row.type !== "line") return max;
            return Math.max(max, row.newLineNum ?? 0);
        }, 1);
        return computeLineNumWidth(maxLine);
    }, [diffRows]);

    return (
        <div className="tw-w-full tw-mt-2 tw-rounded tw-border tw-border-border tw-overflow-hidden tw-bg-[#f6f8fa] dark:tw-bg-[#0d1117]">
            <div className="tw-font-mono tw-text-xs tw-leading-relaxed tw-max-h-48 tw-overflow-y-auto">
                {diffRows.length === 0 ? (
                    <div className="tw-px-2 tw-py-1 tw-text-muted-foreground">No changes</div>
                ) : diffRows.map((row, index) => {
                    if (row.type === "ellipsis") {
                        return (
                            <div key={index} className="tw-flex tw-items-center tw-bg-transparent tw-text-muted-foreground">
                                <span className="tw-select-none tw-px-1 tw-py-0.5 tw-text-right tw-border-r tw-border-border/60" style={{ width: lineNumWidth }} />
                                <span className="tw-px-2 tw-py-0.5 tw-font-mono tw-text-xs">...</span>
                            </div>
                        );
                    }

                    const diff = row.line;
                    const isDelete = diff.type === "delete";
                    const isAdd = diff.type === "add";

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

                    const lineNumColor = isDelete
                        ? "tw-text-[#82071e]/70 dark:tw-text-[#ffa198]/70"
                        : isAdd
                            ? "tw-text-[#116329]/70 dark:tw-text-[#3fb950]/70"
                            : "tw-text-muted-foreground";

                    return (
                        <div key={index} className={`tw-flex tw-items-start ${bgColor} ${borderColor}`}>
                            <span className={`tw-select-none tw-px-1 tw-py-0.5 tw-text-right tw-border-r tw-border-border/60 ${lineNumColor}`} style={{ width: lineNumWidth }}>
                                {row.newLineNum ?? ""}
                            </span>
                            <span className={`tw-select-none tw-px-2 tw-py-0.5 tw-min-w-[1.5rem] tw-text-center ${prefixBg}`}>
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
    );
};
