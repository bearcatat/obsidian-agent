import { Badge } from "@/ui/elements/badge";
import { Button } from "@/ui/elements/button";
import { X, Plus } from "lucide-react";
import { TFile } from "obsidian";
import React, { useEffect, useCallback } from "react";
import { AddContextNoteModel } from "./AddContextNoteModel";
import { useApp } from "@/hooks/app-context";
import { Context } from "@/types";

function ContextNoteBadge({
  note,
  removeNote,
}: {
  note: TFile;
  removeNote: (note: TFile) => void;
}) {
  return (
    <Badge className="tw-items-center tw-py-0 tw-pl-2 tw-pr-0.5 tw-text-xs">
      <div className="tw-flex tw-items-center tw-gap-1">
        <span className="tw-max-w-40 tw-truncate">{note.basename}</span>
      </div>
      <Button
        variant="ghost2"
        size="fit"
        onClick={() => removeNote(note)}
        aria-label="Remove from context"
      >
        <X className="tw-size-4" />
      </Button>
    </Badge>
  );
}

export const InputContext = ({
  context,
  addNote,
  removeNote
}: {
  context: Context
  addNote: (note: TFile) => void;
  removeNote: (note: TFile) => void
}) => {
  const app = useApp();
  if (!app) {
    return null;
  }

  const onAddContext = () => {
    const model = new AddContextNoteModel(app, addNote);
    model.open();
  };

  const notes = React.useMemo(() => {
    return context.notes;
  }, [context]);

  const hasContext = notes.length > 0;

  return (
    <div className="tw-flex tw-w-full tw-items-center tw-gap-1">
      <div className="tw-flex tw-h-full tw-items-start">
        <Button
          onClick={onAddContext}
          variant="ghost2"
          size="fit"
          className="tw-ml-1 tw-rounded-sm tw-border tw-border-solid tw-border-border"
        >
          <Plus className="tw-size-4" />
          {!hasContext && <span className="tw-pr-1 tw-text-xs tw-leading-4">Add context</span>}
        </Button>
      </div>
      <div className="tw-flex tw-flex-1 tw-flex-wrap tw-gap-1">
        {notes.map((note) => (
          <ContextNoteBadge
            key={note.path}
            note={note}
            removeNote={removeNote}
          />
        ))}
      </div>
    </div>
  );
};