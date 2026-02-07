import { Badge } from "@/ui/elements/badge";
import { Button } from "@/ui/elements/button";
import { X, Plus, ImageIcon } from "lucide-react";
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

function ContextImageBadge({
  image,
  index,
  removeImage,
}: {
  image: string;
  index: number;
  removeImage: (index: number) => void;
}) {
  return (
    <Badge className="tw-items-center tw-py-0 tw-pl-0.5 tw-pr-0.5 tw-text-xs tw-gap-1">
      <img
        src={image}
        alt={`Pasted image ${index + 1}`}
        className="tw-w-6 tw-h-6 tw-object-cover tw-rounded"
      />
      <Button
        variant="ghost2"
        size="fit"
        onClick={() => removeImage(index)}
        aria-label="Remove image from context"
      >
        <X className="tw-size-4" />
      </Button>
    </Badge>
  );
}

export const InputContext = ({
  context,
  addNote,
  removeNote,
  removeImage
}: {
  context: Context
  addNote: (note: TFile) => void;
  removeNote: (note: TFile) => void;
  removeImage?: (index: number) => void;
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

  const images = React.useMemo(() => {
    return context.images;
  }, [context]);

  const hasContext = notes.length > 0 || images.length > 0;

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
        {images.map((image, index) => (
          <ContextImageBadge
            key={`${index}-${image.slice(0, 20)}`}
            image={image}
            index={index}
            removeImage={removeImage || (() => {})}
          />
        ))}
      </div>
    </div>
  );
};