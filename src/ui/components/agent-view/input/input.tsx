import React, { useState } from 'react';
import { InputContext } from './context';
import { InputButtom } from './buttom';
import { Textarea } from './textarea';
import { useAgentLogic, useAgentState } from '../../../../hooks/use-agent';
import { useApp } from '../../../../hooks/app-context';
import { TFile } from 'obsidian';
import { Context } from '@/types';

export const Input = () => {
  const app = useApp();
  const emptyContext: Context = {
    activeNote: null,
    notes: [],
    images: [],
  }

  const [message, setMessage] = useState('');
  const [context, setContext] = useState<Context>(emptyContext)
  const { isLoading } = useAgentState();
  const { sendMessage } = useAgentLogic();

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const onSend = () => {
    if (!message.trim() || isLoading) return;
    const activeNote = app?.workspace.getActiveFile() ?? null;
    const newContext = { ...context, activeNote };
    sendMessage(message.trim(), newContext);
    clear();
  };

  const clear = () => {
    setMessage('');
    setContext(emptyContext);
  }

  const handleDropFiles = (files: TFile[]) => {
    setContext(prev => {
      const existingPaths = new Set(prev.notes.map(n => n.path));
      const uniqueFiles = files.filter(file => !existingPaths.has(file.path));
      return { ...prev, notes: [...prev.notes, ...uniqueFiles] };
    });
  };

  const addNoteToContext = (note: TFile) => {
    if (!context.notes.some(n => n.path === note.path)) {
      setContext(prev => ({ ...prev, notes: [...prev.notes, note] }));
    }
  }

  const removeNoteFromContext = (note: TFile) => {
    setContext(prev => ({
      ...prev,
      notes: prev.notes.filter(n => n.path !== note.path)
    }));
  }

  return (
    <div className="tw-flex tw-w-full tw-flex-col tw-gap-0.5 tw-rounded-md tw-border tw-border-solid tw-border-border tw-px-1 tw-pb-1 tw-pt-2 tw-@container/chat-input">
      <InputContext
        context={context}
        addNote={addNoteToContext}
        removeNote={removeNoteFromContext} />
      <div className="tw-relative">
        <Textarea
          value={message}
          onChange={setMessage}
          onKeyDown={onKeyDown}
          disabled={isLoading}
          onDropFiles={handleDropFiles}
        />
      </div>
      <InputButtom onSend={onSend} />
    </div>
  );
};
