import React, { useState } from 'react';
import { InputContext } from './context';
import { InputButtom } from './buttom';
import { Textarea } from './textarea';
import { useAgentLogic, useAgentState } from '../../../../hooks/use-agent';
import { useApp } from '../../../../hooks/app-context';
import { TFile } from 'obsidian';

export interface InputProps {
}

export const Input: React.FC<InputProps> = () => {
  const [message, setMessage] = useState('');
  const { isLoading } = useAgentState();
  const { sendMessage, addContextNote } = useAgentLogic();
  const app = useApp();
  const placeholder =  `输入消息...`

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const onSend = () => {
    if (!message.trim() || isLoading) return;
    sendMessage(message.trim());
    setMessage('');
  };

  const handleDropFiles = (files: TFile[]) => {
    if (!app) return;
    const activeFile = app.workspace.getActiveFile();
    files.forEach(file => {
      const isActive = activeFile?.path === file.path;
      addContextNote(file, isActive);
    });
  };

  return (
    <div className="tw-flex tw-w-full tw-flex-col tw-gap-0.5 tw-rounded-md tw-border tw-border-solid tw-border-border tw-px-1 tw-pb-1 tw-pt-2 tw-@container/chat-input">
      <InputContext />
      <div className="tw-relative">
        <Textarea
          value={message}
          onChange={setMessage}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          onDropFiles={handleDropFiles}
        />
      </div>
      <InputButtom onSend={onSend} />
    </div>
  );
};
