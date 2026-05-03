import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { TFile, normalizePath } from 'obsidian';
import { ModelConfig, ModelVariant } from '../types';
import { FileReviewEntry, MessageV2 } from '@/types';
import { AgentStateData } from './agent-state';
import { ModelMessage } from 'ai';
import { SnapshotLogic } from '@/logic/snapshot-logic';
import { hashReviewContent } from '@/logic/file-review-utils';
import { ToolMessage } from '@/messages/tool-message';
import { getGlobalApp } from '@/utils';

interface AgentStore extends AgentStateData {
  // 状态操作
  setSessionId: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  addMessage: (message: MessageV2) => void;
  setModelMessages: (modelMessages: ModelMessage[]) => void;
  undoToMessage: (messageId: string) => Promise<void>;
  setTitle: (title: string) => void;
  setModel: (model: ModelConfig) => void;
  setVariant: (variant: ModelVariant | null) => void;
  setAbortController: (abortController: AbortController) => void;
  setFileReviews: (fileReviews: FileReviewEntry[]) => void;
  upsertFileReview: (fileReview: FileReviewEntry) => void;
  removeFileReview: (filePath: string) => void;
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
  fileReviews: [],
  variant: null,
};

interface FileToolPayload {
  snapshotId?: string;
  undoSnapshotId?: string;
  fileEdit?: {
    file_path?: string;
    old_content?: string;
  };
  writeResult?: {
    file_path?: string;
    old_content?: string;
    is_new_file?: boolean;
  };
}

interface UndoRestoreTarget {
  filePath: string;
  snapshotId?: string;
  undoSnapshotId?: string;
  oldContent?: string;
  isNewFile: boolean;
}

function parseFileToolPayload(content: string): UndoRestoreTarget | null {
  const payload = JSON.parse(content) as FileToolPayload;
  const filePath = payload.fileEdit?.file_path ?? payload.writeResult?.file_path;

  if (!filePath) {
    return null;
  }

  return {
    filePath,
    snapshotId: payload.snapshotId,
    undoSnapshotId: payload.undoSnapshotId,
    oldContent: payload.fileEdit?.old_content ?? payload.writeResult?.old_content,
    isNewFile: payload.writeResult?.is_new_file ?? false,
  };
}

async function restoreFileModification(target: UndoRestoreTarget): Promise<void> {
  const snapshotLogic = SnapshotLogic.getInstance();

  if (target.undoSnapshotId) {
    await snapshotLogic.restoreSnapshot(target.undoSnapshotId, target.filePath);
    return;
  }

  if (target.oldContent !== undefined) {
    await snapshotLogic.restoreFileContent(target.filePath, target.oldContent);
    return;
  }

  if (target.isNewFile) {
    await snapshotLogic.restoreFileContent(target.filePath, null);
    return;
  }

  if (target.snapshotId) {
    await snapshotLogic.restoreSnapshot(target.snapshotId, target.filePath);
  }
}

async function readCurrentFileContent(filePath: string): Promise<string> {
  const app = getGlobalApp();
  const file = app.vault.getAbstractFileByPath(normalizePath(filePath));

  if (file instanceof TFile) {
    return await app.vault.read(file);
  }

  return "";
}

async function rebuildFileReviewsAfterUndo(
  fileReviews: FileReviewEntry[],
  remainingMessages: MessageV2[],
): Promise<FileReviewEntry[]> {
  const remainingToolMessageIds = new Set<string>();
  const remainingToolCallIds = new Set<string>();
  const toolNamesByMessageId = new Map<string, string>();

  for (const message of remainingMessages) {
    if (message.role !== 'tool') {
      continue;
    }

    const toolMessage = message as ToolMessage;
    if (toolMessage.name !== 'write' && toolMessage.name !== 'editFile') {
      continue;
    }

    remainingToolMessageIds.add(toolMessage.id);
    if (toolMessage.tool_call_id) {
      remainingToolCallIds.add(toolMessage.tool_call_id);
    }
    toolNamesByMessageId.set(toolMessage.id, toolMessage.name);
  }

  const nextFileReviews: FileReviewEntry[] = [];
  for (const review of fileReviews) {
    const messageIds = review.messageIds.filter((id) => remainingToolMessageIds.has(id));
    const toolCallIds = review.toolCallIds.filter((id) => remainingToolCallIds.has(id));

    if (messageIds.length === 0 && toolCallIds.length === 0) {
      continue;
    }

    const headContent = await readCurrentFileContent(review.filePath);
    const hasActiveDiff = headContent !== review.baselineContent;
    const toolNames = Array.from(new Set(
      messageIds
        .map((id) => toolNamesByMessageId.get(id))
        .filter((name): name is string => Boolean(name)),
    ));

    nextFileReviews.push({
      ...review,
      messageIds,
      toolCallIds,
      toolNames: toolNames.length > 0 ? toolNames : review.toolNames,
      headContent,
      headHash: hashReviewContent(headContent),
      status: hasActiveDiff ? 'reviewing' : 'reviewed',
      hasActiveDiff,
      isReverted: hasActiveDiff ? false : review.isReverted,
      blocks: [],
      updatedAt: Date.now(),
    });
  }

  return nextFileReviews;
}

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
      const state = get();
      const messageIndex = state.messages.findIndex((m: MessageV2) => m.id === messageId);
      if (messageIndex === -1) return;

      const messagesToDiscard = state.messages.slice(messageIndex);
      for (let i = messagesToDiscard.length - 1; i >= 0; i--) {
        const msg = messagesToDiscard[i];
        if (msg.role === 'tool' && msg.content) {
          const toolName = (msg as ToolMessage).name;
          if (toolName === 'editFile' || toolName === 'write') {
            try {
              const restoreTarget = parseFileToolPayload(msg.content);
              if (restoreTarget) {
                await restoreFileModification(restoreTarget);
              }
            } catch (e) {
              console.error("Failed to restore snapshot for message", msg.id, e);
            }
          }
        }
      }

      const remainingMessages = state.messages.slice(0, messageIndex);
      const nextFileReviews = await rebuildFileReviewsAfterUndo(state.fileReviews, remainingMessages);

      set((state) => {
        const messageIndex = state.messages.findIndex((m) => m.id === messageId);
        if (messageIndex === -1) return;

        state.messages = remainingMessages;
        
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
        state.fileReviews = nextFileReviews;
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
    setVariant: (variant: ModelVariant | null) =>
      set((state) => {
        state.variant = variant;
      }),
    setAbortController: (abortController: AbortController) =>
      set((state) => {
        state.abortController = abortController;
      }),

    setFileReviews: (fileReviews: FileReviewEntry[]) =>
      set((state) => {
        state.fileReviews = fileReviews;
      }),

    upsertFileReview: (fileReview: FileReviewEntry) =>
      set((state) => {
        const existingIndex = state.fileReviews.findIndex((review) => review.filePath === fileReview.filePath);
        if (existingIndex >= 0) {
          state.fileReviews[existingIndex] = fileReview;
        } else {
          state.fileReviews.push(fileReview);
        }
      }),

    removeFileReview: (filePath: string) =>
      set((state) => {
        state.fileReviews = state.fileReviews.filter((review) => review.filePath !== filePath);
      }),

    resetForNewChat: () =>
      set((state) => {
        state.sessionId = null;
        state.messages = [];
        state.modelMessages = [];
        state.isLoading = false;
        state.title = 'New Chat';
        state.abortController = null;
        state.fileReviews = [];
        // variant is intentionally preserved across new chats
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
