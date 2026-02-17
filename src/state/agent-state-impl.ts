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
        const lastMessage = state.messages[state.messages.length - 1];

        // 优化流式消息处理：移除之前的流式消息，如果消息id相同
        if (lastMessage && lastMessage.id === message.id) {
          state.messages.pop();
        }

        // 限制消息数量，防止内存无限增长
        const MAX_MESSAGES = 100;
        if (state.messages.length >= MAX_MESSAGES) {
          // 保留最新的消息，移除最旧的消息
          state.messages = state.messages.slice(-MAX_MESSAGES + 1);
        }

        state.messages.push(message);
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
