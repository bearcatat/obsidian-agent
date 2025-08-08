import { Badge } from "@/ui/elements/badge";
import { Button } from "@/ui/elements/button";
import { X, Plus } from "lucide-react";
import { TFile } from "obsidian";
import React, { useEffect, useCallback } from "react";
import { AddContextNoteModel } from "./AddContextNoteModel";
import { useApp } from "@/hooks/app-context";
import { useAgentLogic, useAgentState } from "@/hooks/use-agent";
import { debounce } from "@/ui/components/utils";

function ContextNoteBadge({
  note,
  isActive = false,
}: {
  note: TFile;
  isActive: boolean;
}) {
  const { removeContextNote } = useAgentLogic();
  return (
    <Badge className="tw-items-center tw-py-0 tw-pl-2 tw-pr-0.5 tw-text-xs">
      <div className="tw-flex tw-items-center tw-gap-1">
        <span className="tw-max-w-40 tw-truncate">{note.basename}</span>
        {isActive && <span className="tw-text-xs tw-text-faint">Current</span>}
      </div>
      <Button
        variant="ghost2"
        size="fit"
        onClick={() => removeContextNote(note.path)}
        aria-label="Remove from context"
      >
        <X className="tw-size-4" />
      </Button>
    </Badge>
  );
}

interface ContextNote {
  note: TFile;
  isActive: boolean;
}

export const InputContext: React.FC = () => {

  const { activeNote, isActiveNoteRemoved, contextNotes } = useAgentState();
  const { setActiveNote } = useAgentLogic();

  const app = useApp();
  if (!app) {
    return null;
  }

  const onAddContext = () => {
    const model = new AddContextNoteModel(app);
    model.open();
  };

  // 使用防抖函数处理文件变化
  const handleActiveFileChange = useCallback(
    debounce(() => {
      const activeNote = app.workspace.getActiveFile();
      if (activeNote) {
        setActiveNote(activeNote);
      }
    }, 100),
    [app.workspace, setActiveNote]
  );

  useEffect(() => {
    const activeLeafChangeEventRef = app.workspace.on("active-leaf-change", handleActiveFileChange);
    const fileOpenEventRef = app.workspace.on("file-open", handleActiveFileChange);

    return () => {
      app.workspace.offref(activeLeafChangeEventRef);
      app.workspace.offref(fileOpenEventRef);
    };
  }, [app.workspace, handleActiveFileChange]);

  const notes = React.useMemo(() => {
    const notes = contextNotes.map((note) => ({ note, isActive: false } as ContextNote));
    if (activeNote && !isActiveNoteRemoved) {
      notes.unshift({ note: activeNote, isActive: true } as ContextNote);
    }
    return notes;
  }, [contextNotes, activeNote, isActiveNoteRemoved]);

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
            key={note.note.path}
            note={note.note}
            isActive={note.isActive}
          />
        ))}
      </div>
    </div>
  );
};