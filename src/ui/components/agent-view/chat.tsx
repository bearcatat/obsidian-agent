import React from 'react';
import { Title } from './title';
import { Input } from './input/input';
import { Messages } from './messages/messages';

export interface ChatProps {
}

export const Chat: React.FC<ChatProps> = () => {

  return (
    <div className="tw-h-full">
      <div className="tw-relative tw-flex tw-h-full tw-flex-col">
        <div className="tw-flex tw-size-full tw-flex-col tw-overflow-hidden">
          <Title />
          <Messages />
          <Input />
        </div>
      </div>
    </div>
  );
};
