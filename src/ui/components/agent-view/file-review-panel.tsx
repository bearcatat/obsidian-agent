import React from "react";
import { useAgentLogic, useAgentState } from "@/hooks/use-agent";
import { Collapsible, CollapsibleContent } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import { Check, FilePenLine, Undo2 } from "lucide-react";
import { FileReviewEntry } from "@/types";
import { FileReviewDialog } from "./file-review-dialog";
import { Table, TableBody, TableCell, TableRow } from "@/ui/elements/tables";

function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function computeLineDiffStats(entry: FileReviewEntry): { added: number; removed: number } {
  if (entry.isNewFile) {
    return { added: splitLines(entry.headContent).length, removed: 0 };
  }
  const baseLines = splitLines(entry.baselineContent);
  const headLines = splitLines(entry.headContent);
  // Multiset difference: count lines unique to each side
  const baseMap = new Map<string, number>();
  for (const line of baseLines) {
    baseMap.set(line, (baseMap.get(line) ?? 0) + 1);
  }
  let added = 0;
  const remaining = new Map(baseMap);
  for (const line of headLines) {
    const count = remaining.get(line) ?? 0;
    if (count > 0) {
      remaining.set(line, count - 1);
    } else {
      added++;
    }
  }
  let removed = 0;
  for (const count of remaining.values()) {
    removed += count;
  }
  return { added, removed };
}

type ReviewingEntry = FileReviewEntry & { status: "reviewing" };
function isReviewing(r: FileReviewEntry): r is ReviewingEntry {
  return r.status === "reviewing";
}

export const FileReviewPanel = () => {
  const { fileReviews } = useAgentState();
  const {
    applyFileReview,
    rejectFileReview,
    applyAllFileReviews,
    rejectAllFileReviews,
    focusFileReview,
  } = useAgentLogic();
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedFilePath, setSelectedFilePath] = React.useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  // savedIndexRef records the last valid pending index before the current file is reviewed,
  // used to determine which file to advance to after the current one is completed.
  const savedIndexRef = React.useRef(-1);

  const activeReviews = React.useMemo(
    () => fileReviews
      .filter((review) => review.hasActiveDiff)
      .slice()
      .sort((left, right) => right.updatedAt - left.updatedAt),
    [fileReviews]
  );

  const pending = React.useMemo(
    () => activeReviews.filter(isReviewing),
    [activeReviews]
  );

  const diffStats = React.useMemo(
    () => {
      const map = new Map<string, { added: number; removed: number }>();
      for (const entry of pending) {
        map.set(entry.filePath, computeLineDiffStats(entry));
      }
      return map;
    },
    [pending]
  );

  const totalDiffStats = React.useMemo(
    () => {
      let added = 0;
      let removed = 0;
      for (const stats of diffStats.values()) {
        added += stats.added;
        removed += stats.removed;
      }
      return { added, removed };
    },
    [diffStats]
  );

  const selectedReview = React.useMemo(
    () => activeReviews.find((review) => review.filePath === selectedFilePath) ?? null,
    [activeReviews, selectedFilePath]
  );

  const currentPendingIndex = React.useMemo(
    () => pending.findIndex((r) => r.filePath === selectedFilePath),
    [pending, selectedFilePath]
  );

  // Keep savedIndexRef in sync with the current position while the dialog is open
  React.useEffect(() => {
    if (currentPendingIndex >= 0) savedIndexRef.current = currentPendingIndex;
  }, [currentPendingIndex]);

  // Auto-advance to the next pending file when the current file is reviewed.
  // When pending becomes empty, close the dialog.
  React.useEffect(() => {
    if (!selectedFilePath || !isDialogOpen) {
      return;
    }

    if (!selectedReview) {
      if (pending.length > 0) {
        const nextIndex = Math.min(savedIndexRef.current, pending.length - 1);
        const nextFile = pending[Math.max(nextIndex, 0)];
        if (nextFile) {
          setSelectedFilePath(nextFile.filePath);
        } else {
          setIsDialogOpen(false);
          setSelectedFilePath(null);
        }
      } else {
        setIsDialogOpen(false);
        setSelectedFilePath(null);
      }
    }
  }, [isDialogOpen, selectedFilePath, selectedReview, pending]);

  const handleDialogOpenChange = React.useCallback((open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedFilePath(null);
    }
  }, []);

  const navigateToReview = React.useCallback((item: FileReviewEntry) => {
    setSelectedFilePath(item.filePath);
  }, []);

  const handlePrev = React.useCallback(() => {
    if (currentPendingIndex > 0) void navigateToReview(pending[currentPendingIndex - 1]);
  }, [currentPendingIndex, pending, navigateToReview]);

  const handleNext = React.useCallback(() => {
    if (currentPendingIndex < pending.length - 1) void navigateToReview(pending[currentPendingIndex + 1]);
  }, [currentPendingIndex, pending, navigateToReview]);

  const handleFocusReview = React.useCallback((item: FileReviewEntry) => {
    setSelectedFilePath(item.filePath);
    setIsDialogOpen(true);
  }, []);

  const handleOpenInEditor = React.useCallback((event: React.MouseEvent, item: FileReviewEntry) => {
    event.stopPropagation();
    void focusFileReview(item.filePath);
  }, [focusFileReview]);

  if (pending.length === 0) {
    return null;
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="tw-mt-1 tw-rounded-md tw-border tw-border-border">
        <div
          className="tw-flex tw-cursor-pointer tw-items-center tw-justify-between tw-px-2 tw-py-1 tw-select-none hover:tw-bg-primary-alt/30"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <div className="tw-flex tw-items-center tw-gap-1.5 tw-text-xs tw-font-medium tw-text-muted-foreground">
            <span>{pending.length} file(s) changed</span>
            <span className="tw-text-[#116329] dark:tw-text-[#3fb950]">+{totalDiffStats.added}</span>
            <span className="tw-text-[#82071e] dark:tw-text-[#ffa198]">-{totalDiffStats.removed}</span>
          </div>
          <div
            className="tw-flex tw-items-center tw-gap-1"
            onClick={(e) => e.stopPropagation()}
          >
              <Button
                variant="ghost"
                size="fit"
                className="tw-text-accent"
                onClick={() => void applyAllFileReviews()}
              >
                <Check className="tw-size-4" />
                Apply All
              </Button>
              <Button
                variant="ghost"
                size="fit"
                className="tw-text-[#82071e] dark:tw-text-[#ffa198]"
                onClick={() => void rejectAllFileReviews()}
              >
                <Undo2 className="tw-size-4" />
                Reject All
              </Button>
          </div>
        </div>
        <CollapsibleContent>
          <Table>
            <TableBody>
              {pending.map((item) => (
                <TableRow
                  key={item.filePath}
                  className="tw-cursor-pointer"
                  onClick={() => void handleFocusReview(item)}
                >
                  <TableCell className="tw-py-0.5 tw-pl-2">
                    <span className="tw-truncate tw-font-mono tw-text-xs">{item.filePath}</span>
                  </TableCell>
                  <TableCell
                    className="tw-py-0.5 tw-pr-2 tw-text-right tw-whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="tw-flex tw-items-center tw-justify-end tw-gap-0">
                      {(() => {
                        const stats = diffStats.get(item.filePath);
                        return stats ? (
                          <div className="tw-flex tw-items-center tw-gap-0.5 tw-text-xs tw-px-1">
                            <span className="tw-text-[#116329] dark:tw-text-[#3fb950]">+{stats.added}</span>
                            <span className="tw-text-[#82071e] dark:tw-text-[#ffa198]">-{stats.removed}</span>
                          </div>
                        ) : null;
                      })()}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="tw-size-6"
                        onClick={(event) => handleOpenInEditor(event, item)}
                      >
                        <FilePenLine className="tw-size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="tw-size-6 tw-text-accent"
                        onClick={() => applyFileReview(item.filePath)}
                      >
                        <Check className="tw-size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="tw-size-6 tw-text-[#82071e] dark:tw-text-[#ffa198]"
                        onClick={() => { void rejectFileReview(item.filePath); }}
                      >
                        <Undo2 className="tw-size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>
      <FileReviewDialog
        review={selectedReview}
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        currentIndex={currentPendingIndex >= 0 ? currentPendingIndex : 0}
        totalCount={pending.length}
        onPrev={handlePrev}
        onNext={handleNext}
        onApplyFile={applyFileReview}
        onRejectFile={rejectFileReview}
      />
    </>
  );
};