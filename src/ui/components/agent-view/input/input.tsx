import React, { useState } from 'react';
import { InputContext } from './context';
import { InputButtom } from './buttom';
import { Textarea } from './textarea';
import { useAgentLogic, useAgentState } from '../../../../hooks/use-agent';

export interface InputProps {
}

export const Input: React.FC<InputProps> = () => {
  const [message, setMessage] = useState('');
  const { isLoading } = useAgentState();
  const { sendMessage } = useAgentLogic();
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
        />
      </div>
      <InputButtom onSend={onSend} />
    </div>
  );
};
