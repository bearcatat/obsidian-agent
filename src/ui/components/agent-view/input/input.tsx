import React, { useState, useRef, useEffect } from 'react';
import { InputContext } from './context';
import { InputButtom } from './buttom';
import { useAgentLogic, useAgentState } from '../../../../hooks/use-agent';

import { Context } from '@/types';
import { InputEditor, InputEditorRef } from './InputEditor';
import { ContextLogic } from '@/logic/context-logic';
import { InputEditorState } from '@/state/input-editor-state';
import CommandLogic from '@/logic/command-logic';

export const Input = () => {
  const emptyContext: Context = {
    images: [],
  }

  const [message, setMessage] = useState('');
  const [context, setContext] = useState<Context>(emptyContext)
  const { isLoading } = useAgentState();
  const { sendMessage } = useAgentLogic();
  const inputEditorRef = useRef<InputEditorRef>(null);

  useEffect(() => {
    const editorState = InputEditorState.getInstance();
    return () => {
      editorState.setEditorView(null);
    };
  }, []);

  useEffect(() => {
    const editorState = InputEditorState.getInstance();
    const view = inputEditorRef.current?.getEditorView();
    if (view) {
      editorState.setEditorView(view);
    }
  }, [message]);

  const onSend = async () => {
    if (!message.trim() || isLoading) return;
    const contextLogic = ContextLogic.getInstance();
    const finalContext = contextLogic.getContext(context);

    const commandLogic = CommandLogic.getInstance();
    const processed = await commandLogic.processCommand(message.trim());

    if (processed) {
      sendMessage(processed, finalContext);
    } else {
      sendMessage(message.trim(), finalContext);
    }
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
        ref={inputEditorRef}
        value={message}
        onChange={setMessage}
        onSend={onSend}
        disabled={isLoading}
        onPasteImages={handlePasteImages}
      />
      <InputButtom onSend={onSend} />
    </div>
  );
};
