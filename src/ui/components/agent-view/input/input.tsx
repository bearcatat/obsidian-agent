import React, { useState, useRef, useEffect } from 'react';
import { InputContext } from './context';
import { InputButtom } from './buttom';
import { useAgentLogic, useAgentState } from '../../../../hooks/use-agent';

import { Context } from '@/types';
import { InputEditor, InputEditorRef } from './InputEditor';
import { ContextLogic } from '@/logic/context-logic';
import { InputEditorState } from '@/state/input-editor-state';
import CommandLogic from '@/logic/command-logic';
import { UserMessage } from '@/messages/user-message';
import SkillLogic from '@/logic/skill-logic';
import { AgentViewLogic } from '@/logic/agent-view-logic';
import { useAgentStore } from '@/state/agent-state-impl';
import { Notice } from 'obsidian';
import { t } from '../../../../i18n';

export const Input = () => {
  const emptyContext: Context = {
    images: [],
  }

  const [message, setMessage] = useState('');
  const [context, setContext] = useState<Context>(emptyContext)
  const { isLoading } = useAgentState();
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
    editorState.setOnContextChange((images) => {
      setContext(prev => ({
        ...prev,
        images
      }));
    });
  }, [message]);

  const onSend = async () => {
    if (!message.trim()) return;
    const conversationId = useAgentStore.getState().activeConversationId ?? undefined;
    const commandLogic = CommandLogic.getInstance();
    const parsedCommand = commandLogic.parseInput(message.trim());
    if (parsedCommand?.commandName === 'compact') {
      void AgentViewLogic.getInstance().requestContextCompaction(parsedCommand.args, conversationId);
      clear();
      return;
    }
    if (isLoading) {
      new Notice(t('agent:turnStillRunning'));
      return;
    }
    const contextLogic = ContextLogic.getInstance();
    const finalContext = contextLogic.getContext(context);

    const parsedSkill = SkillLogic.getInstance().parseSkillCommand(message.trim());
    if (parsedSkill?.skillName) AgentViewLogic.getInstance().activateSkill(parsedSkill.skillName, conversationId);
    const processed = await commandLogic.processCommand(message.trim());

    void AgentViewLogic.getInstance().sendMessage(new UserMessage(processed ?? message.trim(), finalContext), conversationId);
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
        disabled={false}
        onPasteImages={handlePasteImages}
      />
      <InputButtom onSend={onSend} onAddImages={handlePasteImages} />
    </div>
  );
};
