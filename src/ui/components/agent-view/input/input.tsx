import React, { useState } from 'react';
import { InputContext } from './context';
import { InputButtom } from './buttom';
import { useAgentLogic, useAgentState } from '../../../../hooks/use-agent';

import { Context } from '@/types';
import { InputEditor } from './InputEditor';
import { ContextLogic } from '@/logic/context-logic';

export const Input = () => {
  const emptyContext: Context = {
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
    const contextLogic = ContextLogic.getInstance();
    const finalContext = contextLogic.getContext(context);
    sendMessage(message.trim(), finalContext);
    clear();
  };

  const clear = () => {
    setMessage('');
    setContext(emptyContext);
  }

  const handlePasteImages = (images: string[]) => {
    setContext(prev => ({
      ...prev,
      images: [...(prev.images ?? []), ...images]
    }));
  };

  const removeImageFromContext = (index: number) => {
    setContext(prev => ({
      ...prev,
      images: (prev.images ?? []).filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="tw-flex tw-w-full tw-flex-col tw-gap-0.5 tw-rounded-md tw-border tw-border-solid tw-border-border tw-px-1 tw-pb-1 tw-pt-2 tw-@container/chat-input">
      <InputContext
        context={context}
        removeImage={removeImageFromContext} />
      <InputEditor
        value={message}
        onChange={setMessage}
        onKeyDown={onKeyDown}
        disabled={isLoading}
        onPasteImages={handlePasteImages}
      />
      <InputButtom onSend={onSend} />
    </div>
  );
};
