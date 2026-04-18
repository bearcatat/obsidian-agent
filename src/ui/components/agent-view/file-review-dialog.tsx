import React from "react";
import DiffMatchPatch from "diff-match-patch";
import { Check, FilePenLine, X } from "lucide-react";
import { useAgentLogic } from "@/hooks/use-agent";
import { FileReviewEntry } from "@/types";
import { Button } from "@/ui/elements/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/elements/dialog";
import { cn } from "@/ui/elements/utils";

type DiffLine = {
  type: "equal" | "delete" | "add";
  text: string;
};

type UnifiedDiffRow =
  | {
    kind: "meta" | "hunk";
    text: string;
  }
  | {
    kind: "line";
    type: DiffLine["type"];
    text: string;
    oldLineNumber: number | null;
    newLineNumber: number | null;
    baselineOffset: number | null;  // char offset in baselineContent at start of this line
    headOffset: number | null;      // char offset in headContent at start of this line
  };

type DerivedBlock = {
  rowStartIndex: number;
  rowEndIndex: number;
  baselineStart: number;
  baselineEnd: number;
  headStart: number;
  headEnd: number;
  oldText: string;
  newText: string;
  patchText: string;
  removedCount: number;
  addedCount: number;
  signature: string;
};

type RowActionAnchor = {
  block: DerivedBlock;
  blockIndex: number;
};

const dmp = new DiffMatchPatch();

function toDisplayLines(text: string): string[] {
  const normalized = text.replace(/\r/g, "");
  if (normalized.length === 0) {
    return [];
  }

  const lines = normalized.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    return lines.slice(0, -1);
  }

  return lines;
}

function getLineCount(text: string): number {
  return toDisplayLines(text).length;
}

function buildDiffLines(before: string, after: string): DiffLine[] {
  if (!before && !after) {
    return [];
  }

  if (!before) {
    return toDisplayLines(after).map((text) => ({ type: "add", text }));
  }

  if (!after) {
    return toDisplayLines(before).map((text) => ({ type: "delete", text }));
  }

  const lineDiffs = dmp.diff_linesToChars_(before, after);
  const diffs = dmp.diff_main(lineDiffs.chars1, lineDiffs.chars2, false);
  dmp.diff_cleanupSemantic(diffs);
  dmp.diff_charsToLines_(diffs, lineDiffs.lineArray);

  const result: DiffLine[] = [];
  diffs.forEach(([operation, text]) => {
    for (const line of toDisplayLines(text)) {
      if (operation === -1) {
        result.push({ type: "delete", text: line });
      } else if (operation === 1) {
        result.push({ type: "add", text: line });
      } else {
        result.push({ type: "equal", text: line });
      }
    }
  });

  return result;
}

function buildUnifiedDiffRows(review: FileReviewEntry): UnifiedDiffRow[] {
  const rows: UnifiedDiffRow[] = [];
  const baseline = review.baselineContent.replace(/\r/g, "");
  const head = review.headContent.replace(/\r/g, "");

  let oldLineNumber = 1;
  let newLineNumber = 1;
  let baselineCharOffset = 0;
  let headCharOffset = 0;

  for (const line of buildDiffLines(review.baselineContent, review.headContent)) {
    const lineLen = line.text.length + 1; // +1 for the newline character

    if (line.type === "delete") {
      rows.push({
        kind: "line",
        type: line.type,
        text: line.text,
        oldLineNumber,
        newLineNumber: null,
        baselineOffset: baselineCharOffset,
        headOffset: null,
      });
      oldLineNumber += 1;
      baselineCharOffset += lineLen;
      continue;
    }

    if (line.type === "add") {
      rows.push({
        kind: "line",
        type: line.type,
        text: line.text,
        oldLineNumber: null,
        newLineNumber,
        baselineOffset: null,
        headOffset: headCharOffset,
      });
      newLineNumber += 1;
      headCharOffset += lineLen;
      continue;
    }

    rows.push({
      kind: "line",
      type: line.type,
      text: line.text,
      oldLineNumber,
      newLineNumber,
      baselineOffset: baselineCharOffset,
      headOffset: headCharOffset,
    });
    oldLineNumber += 1;
    newLineNumber += 1;
    baselineCharOffset += lineLen;
    headCharOffset += lineLen;
  }

  void baseline; void head;
  return rows;
}

function buildDerivedBlocks(review: FileReviewEntry, rows: UnifiedDiffRow[]): DerivedBlock[] {
  if (review.status !== "reviewing") {
    return [];
  }

  const blocks: DerivedBlock[] = [];
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];
    if (row.kind !== "line" || row.type === "equal") {
      i += 1;
      continue;
    }

    // Start of a changed segment
    const rowStartIndex = i;
    let baselineStart = row.baselineOffset ?? -1;
    let headStart = row.headOffset ?? -1;
    let baselineEnd = -1;
    let headEnd = -1;
    const oldLines: string[] = [];
    const newLines: string[] = [];

    // Track the last seen offsets for baseline and head within this block
    let lastBaselineEnd = -1;
    let lastHeadEnd = -1;

    // Consume contiguous add/delete rows
    while (i < rows.length) {
      const r = rows[i];
      if (r.kind !== "line" || r.type === "equal") {
        break;
      }
      if (r.type === "delete") {
        oldLines.push(r.text);
        if (baselineStart === -1 && r.baselineOffset !== null) {
          baselineStart = r.baselineOffset;
        }
        if (r.baselineOffset !== null) {
          lastBaselineEnd = r.baselineOffset + r.text.length + 1;
        }
      } else {
        newLines.push(r.text);
        if (headStart === -1 && r.headOffset !== null) {
          headStart = r.headOffset;
        }
        if (r.headOffset !== null) {
          lastHeadEnd = r.headOffset + r.text.length + 1;
        }
      }
      i += 1;
    }

    const rowEndIndex = i - 1;
    baselineEnd = lastBaselineEnd !== -1 ? lastBaselineEnd : baselineStart;
    headEnd = lastHeadEnd !== -1 ? lastHeadEnd : headStart;

    const oldText = oldLines.join("\n") + (oldLines.length > 0 ? "\n" : "");
    const newText = newLines.join("\n") + (newLines.length > 0 ? "\n" : "");

    // Re-derive baseline start if only adds (no deletes)
    if (baselineStart === -1) {
      // Find the nearest baseline offset from context rows before rowStartIndex
      for (let k = rowStartIndex - 1; k >= 0; k--) {
        const prev = rows[k];
        if (prev.kind === "line" && prev.baselineOffset !== null) {
          baselineStart = prev.baselineOffset + prev.text.length + 1;
          break;
        }
      }
      if (baselineStart === -1) baselineStart = 0;
      baselineEnd = baselineStart;
    }

    if (headStart === -1) {
      for (let k = rowStartIndex - 1; k >= 0; k--) {
        const prev = rows[k];
        if (prev.kind === "line" && prev.headOffset !== null) {
          headStart = prev.headOffset + prev.text.length + 1;
          break;
        }
      }
      if (headStart === -1) headStart = 0;
      headEnd = headStart;
    }

    // Build patchText directly from old/new text at offset
    const baselineNorm = review.baselineContent.replace(/\r/g, "");
    const patchArr = dmp.patch_make(baselineNorm, [
      [0 /* EQUAL */, baselineNorm.slice(0, baselineStart)],
      [-1 /* DELETE */, oldText],
      [1 /* INSERT */, newText],
      [0 /* EQUAL */, baselineNorm.slice(baselineEnd)],
    ] as any);
    const patchText = dmp.patch_toText(patchArr);

    const signature = `${baselineStart}:${baselineEnd}:${oldText}:${newText}`;

    blocks.push({
      rowStartIndex,
      rowEndIndex,
      baselineStart,
      baselineEnd,
      headStart,
      headEnd,
      oldText,
      newText,
      patchText,
      removedCount: oldLines.length,
      addedCount: newLines.length,
      signature,
    });
  }

  return blocks;
}

function buildRowActionAnchors(derivedBlocks: DerivedBlock[]): Map<number, RowActionAnchor[]> {
  const anchors = new Map<number, RowActionAnchor[]>();

  derivedBlocks.forEach((block, blockIndex) => {
    const anchorIndex = block.rowEndIndex;
    const existing = anchors.get(anchorIndex) ?? [];
    existing.push({ block, blockIndex });
    anchors.set(anchorIndex, existing);
  });

  return anchors;
}

function UnifiedDiffRowActions({
  anchors,
  onAccept,
  onReject,
}: {
  anchors: RowActionAnchor[];
  onAccept: (block: DerivedBlock) => void;
  onReject: (block: DerivedBlock) => void;
}) {
  return (
    <div className="tw-absolute tw-right-2 tw-top-1/2 tw-z-10 tw-flex -tw-translate-y-1/2 tw-flex-col tw-items-end tw-gap-1">
      {anchors.map(({ block, blockIndex }) => (
        <div key={`${block.baselineStart}-${block.headStart}`} className="tw-flex tw-items-center tw-gap-1 tw-rounded-full tw-border tw-border-border tw-bg-primary tw-px-2 tw-py-1 tw-shadow-md">
          <Button
            variant="ghost"
            size="fit"
            className="tw-text-green-600 dark:tw-text-green-400"
            onClick={() => onAccept(block)}
          >
            <Check className="tw-size-4" />
            Accept
          </Button>
          <Button
            variant="ghost"
            size="fit"
            className="tw-text-red-600 dark:tw-text-red-400"
            onClick={() => onReject(block)}
          >
            <X className="tw-size-4" />
            Reject
          </Button>
        </div>
      ))}
    </div>
  );
}

function UnifiedDiffRowView({
  row,
  lineNumberWidth,
  review,
  actionAnchors,
  onAccept,
  onReject,
}: {
  row: UnifiedDiffRow;
  lineNumberWidth: string;
  review: FileReviewEntry;
  actionAnchors?: RowActionAnchor[];
  onAccept: (block: DerivedBlock) => void;
  onReject: (block: DerivedBlock) => void;
}) {
  if (row.kind === "meta") {
    return (
      <div className="tw-flex tw-items-start tw-bg-slate-100 tw-px-3 tw-py-1 tw-font-mono tw-text-xs tw-text-slate-600 dark:tw-bg-slate-900 dark:tw-text-slate-300">
        {row.text}
      </div>
    );
  }

  if (row.kind === "hunk") {
    return (
      <div className="tw-flex tw-items-start tw-bg-sky-100 tw-px-3 tw-py-1 tw-font-mono tw-text-xs tw-text-sky-700 dark:tw-bg-sky-950/60 dark:tw-text-sky-300">
        {row.text}
      </div>
    );
  }

  const lineRow = row as Extract<UnifiedDiffRow, { kind: "line" }>;
  const isDelete = lineRow.type === "delete";
  const isAdd = lineRow.type === "add";
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
  const prefixColor = isDelete
    ? "tw-bg-[#ffd7d9] dark:tw-bg-[#67060c] tw-text-[#82071e] dark:tw-text-[#ffa198]"
    : isAdd
      ? "tw-bg-[#acf2bd] dark:tw-bg-[#0c3228] tw-text-[#116329] dark:tw-text-[#3fb950]"
      : "tw-bg-transparent tw-text-muted-foreground";
  const textColor = isDelete
    ? "tw-text-[#82071e] dark:tw-text-[#ffa198]"
    : isAdd
      ? "tw-text-[#116329] dark:tw-text-[#3fb950]"
      : "tw-text-foreground";
  const lineNumberColor = isDelete
    ? "tw-text-[#82071e]/70 dark:tw-text-[#ffa198]/70"
    : isAdd
      ? "tw-text-[#116329]/70 dark:tw-text-[#3fb950]/70"
      : "tw-text-muted-foreground";

  return (
    <div className={cn("tw-relative tw-flex tw-items-start tw-select-text tw-font-mono tw-text-xs", bgColor, borderColor, actionAnchors?.length ? "tw-pr-[19rem]" : undefined)}>
      <span className={cn("tw-select-none tw-border-r tw-border-border/60 tw-px-2 tw-py-0.5 tw-text-right", lineNumberColor)} style={{ width: lineNumberWidth }}>
        {lineRow.newLineNumber ?? ""}
      </span>
      <span className={cn("tw-min-w-[2rem] tw-select-none tw-px-2 tw-py-0.5 tw-text-center", prefixColor)}>
        {prefix}
      </span>
      <span className={cn("tw-flex-1 tw-whitespace-pre tw-py-0.5 tw-pr-2", textColor)}>
        {lineRow.text || " "}
      </span>
      {actionAnchors?.length ? <UnifiedDiffRowActions anchors={actionAnchors} onAccept={onAccept} onReject={onReject} /> : null}
    </div>
  );
}

export function FileReviewDialog({
  review,
  open,
  onOpenChange,
}: {
  review: FileReviewEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    applyFileReview,
    rejectFileReview,
    applyDerivedBlock,
    rejectDerivedBlock,
  } = useAgentLogic();

  const unifiedDiffRows = React.useMemo(
    () => review ? buildUnifiedDiffRows(review) : [],
    [review]
  );
  const derivedBlocks = React.useMemo(
    () => review ? buildDerivedBlocks(review, unifiedDiffRows) : [],
    [review, unifiedDiffRows]
  );
  const lineNumberWidth = React.useMemo(() => {
    const largestLineNumber = Math.max(getLineCount(review?.headContent ?? ""), 1);
    return `${String(largestLineNumber).length + 2}ch`;
  }, [review]);
  const rowActionAnchors = React.useMemo(
    () => buildRowActionAnchors(derivedBlocks),
    [derivedBlocks]
  );

  const handleAccept = React.useCallback((block: DerivedBlock) => {
    if (!review) return;
    void applyDerivedBlock(review.filePath, block);
  }, [review, applyDerivedBlock]);

  const handleReject = React.useCallback((block: DerivedBlock) => {
    if (!review) return;
    void rejectDerivedBlock(review.filePath, block);
  }, [review, rejectDerivedBlock]);
  const dialogSize = "76vh";

  if (!review) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="tw-overflow-hidden tw-p-0 sm:tw-rounded-lg"
        style={{
          width: dialogSize,
          maxWidth: dialogSize,
          height: dialogSize,
          maxHeight: dialogSize,
        }}
      >
        <div className="tw-flex tw-h-full tw-flex-col tw-gap-2 tw-overflow-hidden tw-p-4">
        <DialogHeader className="tw-pr-8">
          <DialogTitle className="tw-flex tw-items-center tw-gap-2 tw-text-base tw-mb-0">
            <FilePenLine className="tw-size-4 tw-flex-shrink-0" />
            <span className="tw-truncate tw-font-mono tw-text-sm">{review.filePath}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="tw-flex tw-min-h-0 tw-flex-1 tw-flex-col tw-overflow-hidden tw-rounded-md tw-border tw-border-border tw-bg-[#f6f8fa] dark:tw-bg-[#0d1117]">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2 tw-border-b tw-border-border tw-bg-primary/60 tw-px-3 tw-py-2 tw-text-xs tw-text-muted-foreground">
            <span>Full unified diff</span>
            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-1">
              {review.status === "reviewing" ? (
              <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-1">
                <Button variant="ghost" size="sm" className="tw-text-green-600 dark:tw-text-green-400" onClick={() => applyFileReview(review.filePath)}>
                  <Check className="tw-size-4" />
                  Apply File
                </Button>
                <Button variant="ghost" size="sm" className="tw-text-red-600 dark:tw-text-red-400" onClick={() => { void rejectFileReview(review.filePath); }}>
                  <X className="tw-size-4" />
                  Reject File
                </Button>
              </div>
              ) : null}
            </div>
          </div>
          <div className="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-select-text">
            {unifiedDiffRows.map((row, index) => (
              <UnifiedDiffRowView
                key={`row-${row.kind}-${index}`}
                row={row}
                lineNumberWidth={lineNumberWidth}
                review={review}
                actionAnchors={rowActionAnchors.get(index)}
                onAccept={handleAccept}
                onReject={handleReject}
              />
            ))}
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}