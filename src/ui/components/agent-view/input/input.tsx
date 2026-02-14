import React, { useState } from 'react';
import { InputContext } from './context';
import { InputButtom } from './buttom';
import { useAgentLogic, useAgentState } from '../../../../hooks/use-agent';
import { useApp } from '../../../../hooks/app-context';

import { Context } from '@/types';
import { InputEditor } from './InputEditor';

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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

  const handlePasteImages = (images: string[]) => {
    setContext(prev => ({
      ...prev,
      images: [...prev.images, ...images]
    }));
  };

  const removeImageFromContext = (index: number) => {
    setContext(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="tw-flex tw-w-full tw-flex-col tw-gap-0.5 tw-rounded-md tw-border tw-border-solid tw-border-border tw-px-1 tw-pb-1 tw-pt-2 tw-@container/chat-input">
      <InputContext
        context={context}
        removeImage={removeImageFromContext} />
      <div className="tw-relative">
        <InputEditor
          value={message}
          onChange={setMessage}
          onKeyDown={onKeyDown}
          disabled={isLoading}
          onPasteImages={handlePasteImages}
        />
      </div>
      <InputButtom onSend={onSend} />
    </div>
  );
};
