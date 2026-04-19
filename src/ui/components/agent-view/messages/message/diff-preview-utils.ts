import DiffMatchPatch from "diff-match-patch";

export type DiffPreviewLine = {
    type: "equal" | "delete" | "add";
    text: string;
};

export type DiffPreviewRow =
    | { type: "line"; line: DiffPreviewLine; oldLineNum?: number; newLineNum?: number }
    | { type: "ellipsis" };

export function buildLineDiff(oldText: string, newText: string): DiffPreviewLine[] {
    const dmp = new DiffMatchPatch();
    const lineDiffs = dmp.diff_linesToChars_(oldText, newText);
    const diffs = dmp.diff_main(lineDiffs.chars1, lineDiffs.chars2, false);
    dmp.diff_cleanupSemantic(diffs);
    dmp.diff_charsToLines_(diffs, lineDiffs.lineArray);

    const result: DiffPreviewLine[] = [];
    diffs.forEach((diff: [number, string]) => {
        const [op, text] = diff;
        const textLines = text.split("\n");
        textLines.forEach((line: string, index: number) => {
            if (index === textLines.length - 1 && line === "") {
                return;
            }

            if (op === -1) {
                result.push({ type: "delete", text: line });
                return;
            }

            if (op === 1) {
                result.push({ type: "add", text: line });
                return;
            }

            result.push({ type: "equal", text: line });
        });
    });

    return result;
}

export function buildHunkPreviewRows(lines: DiffPreviewLine[], contextLines = 2): DiffPreviewRow[] {
    const changedIndexes: number[] = [];
    lines.forEach((line, index) => {
        if (line.type !== "equal") {
            changedIndexes.push(index);
        }
    });

    if (changedIndexes.length === 0) {
        return [];
    }

    const ranges = changedIndexes.map((index) => ({
        start: Math.max(0, index - contextLines),
        end: Math.min(lines.length - 1, index + contextLines),
    }));

    const mergedRanges: Array<{ start: number; end: number }> = [];
    ranges.forEach((range) => {
        const lastRange = mergedRanges[mergedRanges.length - 1];
        if (!lastRange) {
            mergedRanges.push(range);
            return;
        }

        if (range.start <= lastRange.end + 1) {
            lastRange.end = Math.max(lastRange.end, range.end);
            return;
        }

        mergedRanges.push(range);
    });

    // Precompute old/new line numbers for each line index
    const lineNums: { oldLineNum?: number; newLineNum?: number }[] = [];
    let oldNum = 1;
    let newNum = 1;
    for (const line of lines) {
        if (line.type === "delete") {
            lineNums.push({ oldLineNum: oldNum++, newLineNum: undefined });
        } else if (line.type === "add") {
            lineNums.push({ oldLineNum: undefined, newLineNum: newNum++ });
        } else {
            lineNums.push({ oldLineNum: oldNum++, newLineNum: newNum++ });
        }
    }

    const rows: DiffPreviewRow[] = [];
    mergedRanges.forEach((range, rangeIndex) => {
        for (let i = range.start; i <= range.end; i += 1) {
            rows.push({ type: "line", line: lines[i], ...lineNums[i] });
        }

        if (rangeIndex < mergedRanges.length - 1) {
            rows.push({ type: "ellipsis" });
        }
    });

    return rows;
}

export function computeLineNumWidth(maxLine: number): string {
    return `${String(Math.max(maxLine, 1)).length + 2}ch`;
}
