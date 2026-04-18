import React from "react";
import { useAgentLogic, useAgentState } from "@/hooks/use-agent";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import { ChevronsUpDown, Check, FilePenLine, X } from "lucide-react";
import { FileReviewEntry } from "@/types";
import { FileReviewDialog } from "./file-review-dialog";

function ReviewSection({
  title,
  items,
  showActions,
  renderTrailing,
  onApply,
  onReject,
  onFocus,
}: {
  title: string;
  items: FileReviewEntry[];
  showActions?: boolean;
  renderTrailing?: (item: FileReviewEntry) => React.ReactNode;
  onApply: (filePath: string) => void;
  onReject: (filePath: string) => void;
  onFocus: (item: FileReviewEntry) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="tw-flex tw-flex-col tw-gap-1">
      <div className="tw-px-1 tw-text-xs tw-font-medium tw-text-muted-foreground">{title}</div>
      {items.map((item) => (
        <div key={item.filePath} className="tw-flex tw-items-center tw-gap-2 tw-rounded-md tw-border tw-border-border tw-px-2 tw-py-1.5">
          <button
            type="button"
            className="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-2 tw-text-left hover:tw-text-accent"
            onClick={() => onFocus(item)}
          >
            <FilePenLine className="tw-size-4 tw-flex-shrink-0" />
            <span className="tw-truncate tw-font-mono tw-text-xs">{item.filePath}</span>
          </button>
          {renderTrailing ? renderTrailing(item) : showActions ? (
            <div className="tw-flex tw-items-center tw-gap-1">
              <Button variant="ghost" size="fit" className="tw-text-green-600 dark:tw-text-green-400" onClick={() => onApply(item.filePath)}>
                <Check className="tw-size-4" />
                Apply
              </Button>
              <Button variant="ghost" size="fit" className="tw-text-red-600 dark:tw-text-red-400" onClick={() => onReject(item.filePath)}>
                <X className="tw-size-4" />
                Reject
              </Button>
            </div>
          ) : (
            <span className="tw-text-xs tw-text-muted-foreground">Reviewed</span>
          )}
        </div>
      ))}
    </div>
  );
}

export const FileReviewPanel = () => {
  const { fileReviews } = useAgentState();
  const {
    applyFileReview,
    rejectFileReview,
    adoptFileReviewHead,
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

  const reviewing = React.useMemo(
    () => activeReviews.filter((review) => review.status === "reviewing"),
    [activeReviews]
  );
  const pending = React.useMemo(
    () => activeReviews.filter((review) => review.status !== "reviewed"),
    [activeReviews]
  );
  const reviewed = React.useMemo(
    () => activeReviews.filter((review) => review.status === "reviewed"),
    [activeReviews]
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

  const navigateToReview = React.useCallback(async (item: FileReviewEntry) => {
    const itemStatus = item.status as string;
    if (itemStatus !== "reviewing" && itemStatus !== "reviewed") {
      await adoptFileReviewHead(item.filePath);
    }
    setSelectedFilePath(item.filePath);
  }, [adoptFileReviewHead]);

  const handlePrev = React.useCallback(() => {
    if (currentPendingIndex > 0) void navigateToReview(pending[currentPendingIndex - 1]);
  }, [currentPendingIndex, pending, navigateToReview]);

  const handleNext = React.useCallback(() => {
    if (currentPendingIndex < pending.length - 1) void navigateToReview(pending[currentPendingIndex + 1]);
  }, [currentPendingIndex, pending, navigateToReview]);

  const handleFocusReview = React.useCallback(async (item: FileReviewEntry) => {
    if (item.status === "reviewed") {
      void focusFileReview(item.filePath);
      return;
    }

    const itemStatus = item.status as string;
    if (itemStatus !== "reviewing" && itemStatus !== "reviewed") {
      await adoptFileReviewHead(item.filePath);
    }

    setSelectedFilePath(item.filePath);
    setIsDialogOpen(true);
  }, [adoptFileReviewHead, focusFileReview]);

  if (activeReviews.length === 0) {
    return null;
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="tw-mt-1 tw-flex tw-flex-col tw-gap-1 tw-rounded-md tw-border tw-border-border tw-px-2 tw-py-1">
        <div className="tw-flex tw-items-center tw-justify-between">
          <div className="tw-text-xs tw-font-medium tw-text-muted-foreground">Changed files {activeReviews.length}</div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <ChevronsUpDown className="tw-size-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="tw-flex tw-flex-col tw-gap-2 tw-pb-1">
          {reviewing.length > 0 && (
            <div className="tw-flex tw-items-center tw-justify-end tw-gap-1">
              <Button variant="ghost" size="fit" className="tw-text-green-600 dark:tw-text-green-400" onClick={() => applyAllFileReviews()}>
                <Check className="tw-size-4" />
                Apply All
              </Button>
              <Button variant="ghost" size="fit" className="tw-text-red-600 dark:tw-text-red-400" onClick={() => void rejectAllFileReviews()}>
                <X className="tw-size-4" />
                Reject All
              </Button>
            </div>
          )}
          <ReviewSection
            title="Reviewing"
            items={pending}
            renderTrailing={(item) => item.status === "reviewing" ? (
              <div className="tw-flex tw-items-center tw-gap-1">
                <Button variant="ghost" size="fit" className="tw-text-green-600 dark:tw-text-green-400" onClick={() => applyFileReview(item.filePath)}>
                  <Check className="tw-size-4" />
                  Apply
                </Button>
                <Button variant="ghost" size="fit" className="tw-text-red-600 dark:tw-text-red-400" onClick={() => { void rejectFileReview(item.filePath); }}>
                  <X className="tw-size-4" />
                  Reject
                </Button>
              </div>
            ) : (
              <span className="tw-text-xs tw-text-muted-foreground">Open to sync</span>
            )}
            onApply={applyFileReview}
            onReject={(filePath) => { void rejectFileReview(filePath); }}
            onFocus={handleFocusReview}
          />
          <ReviewSection
            title="Reviewed"
            items={reviewed}
            onApply={applyFileReview}
            onReject={(filePath) => { void rejectFileReview(filePath); }}
            onFocus={handleFocusReview}
          />
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