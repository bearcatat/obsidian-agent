import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ModelConfig } from '../types';
import { MessageV2 } from '@/types';
import { AgentStateData } from './agent-state';

interface AgentStore extends AgentStateData {
  // 状态操作
  setLoading: (isLoading: boolean) => void;
  addMessage: (message: MessageV2) => void;
  setTitle: (title: string) => void;
  setModel: (model: ModelConfig) => void;
  setAbortController: (abortController: AbortController) => void;
  resetForNewChat: () => void;
  cleanupOldMessages: (keepCount?: number) => void;
  cleanupStreamingMessages: () => void;
}

const initialState: AgentStateData = {
  messages: [],
  isLoading: false,
  title: 'New Chat',
  model: null,
  abortController: null,
};

export const useAgentStore = create<AgentStore>()(
  immer((set) => ({
    ...initialState,

    setLoading: (isLoading: boolean) =>
      set((state) => {
        state.isLoading = isLoading;
      }),

    addMessage: (message: MessageV2) =>
      set((state) => {
        const existingIndex = state.messages.findIndex((m) => m.id === message.id);

        if (existingIndex >= 0) {
          const newMessages = [...state.messages];
          newMessages.splice(existingIndex, 1, message);
          state.messages = newMessages;
        } else {
          state.messages.push(message);
        }
      }),

    setTitle: (title: string) =>
      set((state) => {
        state.title = title;
      }),

    setModel: (model: ModelConfig) =>
      set((state) => {
        state.model = model;
      }),

    setAbortController: (abortController: AbortController) =>
      set((state) => {
        state.abortController = abortController;
      }),

    resetForNewChat: () =>
      set((state) => {
        state.messages = [];
        state.isLoading = false;
        state.title = 'New Chat';
        state.abortController = null;
      }),

    cleanupOldMessages: (keepCount: number = 50) =>
      set((state) => {
        if (state.messages.length > keepCount) {
          state.messages = state.messages.slice(-keepCount);
        }
      }),

    cleanupStreamingMessages: () =>
      set((state) => {
        state.messages = state.messages.filter((message) => !message.isStreaming);
      }),
  }))
);

// 保留向后兼容的单例 API（可选，用于非 React 代码）
export const agentStore = {
  getState: () => useAgentStore.getState(),
  setState: useAgentStore.setState,
  subscribe: useAgentStore.subscribe,
  reset: () => useAgentStore.setState(initialState),
};
