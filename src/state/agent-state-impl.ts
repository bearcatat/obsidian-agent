import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ModelConfig } from '../types';
import { MessageV2 } from '@/types';
import { AgentStateData } from './agent-state';
import { ModelMessage } from 'ai';
import { SnapshotLogic } from '@/logic/snapshot-logic';
import { ToolMessage } from '@/messages/tool-message';

interface AgentStore extends AgentStateData {
  // 状态操作
  setSessionId: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  addMessage: (message: MessageV2) => void;
  setModelMessages: (modelMessages: ModelMessage[]) => void;
  undoToMessage: (messageId: string) => Promise<void>;
  setTitle: (title: string) => void;
  setModel: (model: ModelConfig) => void;
  setAbortController: (abortController: AbortController) => void;
  resetForNewChat: () => void;
  cleanupOldMessages: (keepCount?: number) => void;
  cleanupStreamingMessages: () => void;
}

const initialState: AgentStateData = {
  sessionId: null,
  messages: [],
  modelMessages: [],
  isLoading: false,
  title: 'New Chat',
  model: null,
  abortController: null,
};

export const useAgentStore = create<AgentStore>()(
  immer((set, get) => ({
    ...initialState,

    setSessionId: (id: string) =>
      set((state) => {
        state.sessionId = id;
      }),

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

    setModelMessages: (modelMessages: ModelMessage[]) =>
      set((state) => {
        state.modelMessages = modelMessages as any;
      }),

    undoToMessage: async (messageId: string) => {
      // Restore files first
      const state = get();
      const messageIndex = state.messages.findIndex((m: MessageV2) => m.id === messageId);
      if (messageIndex === -1) return;

      const messagesToDiscard = state.messages.slice(messageIndex);
      // Process in reverse order (LIFO)
      for (let i = messagesToDiscard.length - 1; i >= 0; i--) {
        const msg = messagesToDiscard[i];
        if (msg.role === 'tool' && msg.content) {
          const toolName = (msg as any).name;
          // Only attempt to parse and restore snapshots for file-modifying tools
          if (toolName === 'editFile' || toolName === 'write') {
            try {
              const payload = JSON.parse(msg.content);
              let filePath = "";
              let snapshotId = "";
              
              if (payload.snapshotId) {
                  snapshotId = payload.snapshotId;
                  if (payload.fileEdit?.file_path) filePath = payload.fileEdit.file_path;
                  if (payload.writeResult?.file_path) filePath = payload.writeResult.file_path;
              }
              
              if (snapshotId && filePath) {
                  await SnapshotLogic.getInstance().restoreSnapshot(snapshotId, filePath);
              }
            } catch (e) {
              console.error("Failed to restore snapshot for message", msg.id, e);
            }
          }
        }
      }

      set((state) => {
        const messageIndex = state.messages.findIndex((m) => m.id === messageId);
        if (messageIndex === -1) return;

        // Truncate messages to just before this message
        state.messages = state.messages.slice(0, messageIndex);
        
        // Count how many user messages are kept
        const userMessagesKept = state.messages.filter(m => m.role === 'user').length;
        
        // Truncate modelMessages based on user messages count
        // Each user message corresponds to one User message in modelMessages
        let userMessageCount = 0;
        let truncateIndex = state.modelMessages.length;
        
        for (let i = 0; i < state.modelMessages.length; i++) {
          if (state.modelMessages[i].role === 'user') {
            if (userMessageCount === userMessagesKept) {
              truncateIndex = i;
              break;
            }
            userMessageCount++;
          }
        }
        
        state.modelMessages = state.modelMessages.slice(0, truncateIndex) as any;
        state.isLoading = false;
        if (state.abortController) {
          state.abortController.abort();
          state.abortController = null;
        }
      });
    },

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
        state.sessionId = null;
        state.messages = [];
        state.modelMessages = [];
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
