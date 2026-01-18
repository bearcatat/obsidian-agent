import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import React from "react";
import { FileEdit } from "@/types";
import { ChevronsUpDown, Check, X } from "lucide-react";
import DiffMatchPatch from "diff-match-patch";

type Props = {
    origin_answered_state: boolean;
    fileEdit: FileEdit;
    decision: "apply" | "reject" | null;
    onApply: () => void;
    onReject: () => void;
}

export const FileEditToolMessageCard = ({ origin_answered_state, fileEdit, decision, onApply, onReject }: Props) => {
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

    // 计算 diff
    const diffLines = React.useMemo(() => {
        if (!fileEdit.old_content && !fileEdit.new_content) {
            // 如果没有完整内容，使用 old_string 和 new_string 计算
            if (!fileEdit.old_string && fileEdit.new_string) {
                // 新文件创建
                return fileEdit.new_string.split('\n').map(line => ({
                    type: 'add' as const,
                    text: line,
                }));
            }
            const dmp = new DiffMatchPatch();
            const diffs = dmp.diff_main(fileEdit.old_string || '', fileEdit.new_string || '');
            dmp.diff_cleanupSemantic(diffs);
            return diffs;
        } else {
            // 使用完整文件内容计算行级 diff
            const dmp = new DiffMatchPatch();
            const oldLines = fileEdit.old_content?.split('\n') || [];
            const newLines = fileEdit.new_content?.split('\n') || [];
            
            // 计算行级差异
            const lineDiffs = dmp.diff_linesToChars_(fileEdit.old_content || '', fileEdit.new_content || '');
            const diffs = dmp.diff_main(lineDiffs.chars1, lineDiffs.chars2, false);
            dmp.diff_cleanupSemantic(diffs);
            dmp.diff_charsToLines_(diffs, lineDiffs.lineArray);
            
            // 转换为行数组
            const result: Array<{ type: 'equal' | 'delete' | 'add', text: string }> = [];
            diffs.forEach((diff: [number, string]) => {
                const [op, text] = diff;
                const textLines = text.split('\n');
                textLines.forEach((line: string, index: number) => {
                    if (index === textLines.length - 1 && line === '') return; // 忽略最后一个空行
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
        }
    }, [fileEdit]);

    const statusText = isAnswered 
        ? (decision === "apply" ? "已应用" : decision === "reject" ? "已拒绝" : "已处理")
        : "待确认";

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="tw-w-full tw-rounded-md tw-border tw-border-solid tw-border-border tw-py-1"
        >
            <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-0">
                <div className="tw-flex tw-items-center tw-gap-2">
                    <span>{statusText}:</span>
                    <span className="tw-font-mono tw-text-sm">{fileEdit.file_path}</span>
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
                {/* Diff 可视化 - GitHub 风格 */}
                <div className="tw-w-full tw-mt-2 tw-rounded tw-border tw-border-border tw-overflow-hidden tw-bg-[#f6f8fa] dark:tw-bg-[#0d1117]">
                    <div className="tw-font-mono tw-text-xs tw-leading-relaxed tw-max-h-96 tw-overflow-y-auto">
                        {diffLines.map((diff, index) => {
                            if (typeof diff === 'object' && 'type' in diff) {
                                // 行级 diff
                                const isDelete = diff.type === 'delete';
                                const isAdd = diff.type === 'add';
                                const isEqual = diff.type === 'equal';
                                
                                // GitHub 风格的背景色和边框
                                const bgColor = isDelete 
                                    ? 'tw-bg-[#fff5f5] dark:tw-bg-[#490202]' 
                                    : isAdd
                                    ? 'tw-bg-[#f0fff4] dark:tw-bg-[#033a16]'
                                    : 'tw-bg-transparent';
                                
                                // 左侧竖线颜色
                                const borderColor = isDelete
                                    ? 'tw-border-l-2 tw-border-l-[#fa4549] dark:tw-border-l-[#f85149]'
                                    : isAdd
                                    ? 'tw-border-l-2 tw-border-l-[#3fb950] dark:tw-border-l-[#3fb950]'
                                    : '';
                                
                                // 前缀符号和颜色
                                const prefix = isDelete ? '-' : isAdd ? '+' : ' ';
                                const prefixBg = isDelete
                                    ? 'tw-bg-[#ffd7d9] dark:tw-bg-[#67060c] tw-text-[#82071e] dark:tw-text-[#ffa198]'
                                    : isAdd
                                    ? 'tw-bg-[#acf2bd] dark:tw-bg-[#0c3228] tw-text-[#116329] dark:tw-text-[#3fb950]'
                                    : 'tw-bg-transparent tw-text-muted-foreground';
                                
                                // 文本颜色
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
                                        <span className={`tw-flex-1 tw-py-0.5 tw-pr-2 ${textColor || 'tw-text-foreground'}`}>
                                            {diff.text || '\n'}
                                        </span>
                                    </div>
                                );
                            } else {
                                // 字符级 diff (fallback)
                                const [op, text] = diff as [number, string];
                                const isDelete = op === -1;
                                const isAdd = op === 1;
                                const isEqual = op === 0;
                                
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
                                        <span className={`tw-flex-1 tw-py-0.5 tw-pr-2 ${textColor || 'tw-text-foreground'}`}>
                                            {text}
                                        </span>
                                    </div>
                                );
                            }
                        })}
                    </div>
                </div>
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
