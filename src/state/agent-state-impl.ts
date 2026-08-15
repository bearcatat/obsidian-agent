import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Notice, TFile, normalizePath } from 'obsidian';
import { ContextCheckpoint, ContextRuntimeState, ContextUsageCalibration, ModelConfig, ModelVariant } from '../types';
import { FileReviewEntry, MessageV2 } from '@/types';
import { AgentStateData, ConversationState } from './agent-state';
import { ModelMessage } from 'ai';
import { SnapshotLogic } from '@/logic/snapshot-logic';
import { hashReviewContent } from '@/logic/file-review-utils';
import { ToolMessage } from '@/messages/tool-message';
import { getGlobalApp } from '@/utils';
import { SessionLogic } from '@/logic/session-logic';
import { updateContextRuntimeForModelChange } from '@/llm/ContextCompaction';
import { t } from '@/i18n';

export interface AgentStore extends AgentStateData {
  conversations: Record<string, ConversationState>;
  activeConversationId: string | null;
  createConversation: (id: string, title?: string) => void;
  upsertConversation: (conversation: ConversationState) => void;
  selectConversation: (id: string) => void;
  removeConversation: (id: string) => void;
  // 状态操作
  setSessionId: (id: string) => void;
  setLoading: (isLoading: boolean, conversationId?: string) => void;
  addMessage: (message: MessageV2, conversationId?: string) => void;
  setModelMessages: (modelMessages: ModelMessage[], conversationId?: string) => void;
  undoToMessage: (messageId: string) => Promise<void>;
  setTitle: (title: string, conversationId?: string) => void;
  setModel: (model: ModelConfig) => void;
  setVariant: (variant: ModelVariant | null) => void;
  setAbortController: (abortController: AbortController | null, conversationId?: string) => void;
  setFileReviews: (fileReviews: FileReviewEntry[], conversationId?: string) => void;
  upsertFileReview: (fileReview: FileReviewEntry, conversationId?: string) => void;
  removeFileReview: (filePath: string, conversationId?: string) => void;
  setActiveSkills: (skills: string[], conversationId?: string) => void;
  setContextCheckpoint: (checkpoint: ContextCheckpoint | undefined, conversationId?: string) => void;
  setContextUsageCalibration: (calibration: ContextUsageCalibration | undefined, conversationId?: string) => void;
  setContextRuntimeState: (runtimeState: ContextRuntimeState, conversationId?: string) => void;
  setUnread: (hasUnread: boolean, conversationId?: string) => void;
  setUpdatedAt: (updatedAt: number, conversationId?: string) => void;
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
  contextCheckpoint: undefined,
  contextUsageCalibration: undefined,
  contextRuntimeState: { status: 'idle' },
  activeSkills: [],
};

const registryInitialState = {
  ...initialState,
  conversations: {} as Record<string, ConversationState>,
  activeConversationId: null as string | null,
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

function collectSnapshotIdsFromToolMessage(message: MessageV2, snapshotIds: Set<string>): void {
  if (message.role !== 'tool' || !message.content) {
    return;
  }

  try {
    const payload = JSON.parse(message.content) as FileToolPayload;
    if (payload.snapshotId) {
      snapshotIds.add(payload.snapshotId);
    }
    if (payload.undoSnapshotId) {
      snapshotIds.add(payload.undoSnapshotId);
    }
  } catch (e) {
    // Ignore non-JSON tool payloads during snapshot cleanup.
  }
}

function collectRetainedSnapshotIds(
  messages: MessageV2[],
  fileReviews: FileReviewEntry[],
): Set<string> {
  const retainedSnapshotIds = new Set<string>();

  for (const message of messages) {
    collectSnapshotIdsFromToolMessage(message, retainedSnapshotIds);
  }

  for (const review of fileReviews) {
    retainedSnapshotIds.add(review.baselineSnapshotId);
  }

  return retainedSnapshotIds;
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

function syncActiveConversation(state: any): void {
  const active = state.activeConversationId ? state.conversations[state.activeConversationId] : null;
  const source = active ?? initialState;
  state.sessionId = source.sessionId;
  state.messages = source.messages;
  state.modelMessages = source.modelMessages;
  state.isLoading = source.isLoading;
  state.title = source.title;
  state.abortController = source.abortController;
  state.fileReviews = source.fileReviews;
  state.activeSkills = source.activeSkills ?? [];
  state.contextCheckpoint = source.contextCheckpoint;
  state.contextUsageCalibration = source.contextUsageCalibration;
  state.contextRuntimeState = source.contextRuntimeState ?? { status: 'idle' };
}

function updateConversation(state: any, conversationId: string | undefined, update: (conversation: ConversationState) => void): void {
  const id = conversationId ?? state.activeConversationId;
  if (!id || !state.conversations[id]) return;
  update(state.conversations[id]);
  if (state.activeConversationId === id) syncActiveConversation(state);
}

function createConversationState(id: string, title: string, model: ModelConfig | null, variant: ModelVariant | null): ConversationState {
  const now = Date.now();
  return {
    sessionId: id, messages: [], modelMessages: [], isLoading: false, title,
    model, variant, abortController: null, fileReviews: [], activeSkills: [],
    contextCheckpoint: undefined, contextUsageCalibration: undefined,
    contextRuntimeState: { status: 'idle', contextWindow: model?.contextWindow },
    createdAt: now, updatedAt: now, status: 'idle', hasUnread: false,
  };
}

export const useAgentStore = create<AgentStore>()(
  immer((set, get) => ({
    ...registryInitialState,

    createConversation: (id: string, title: string = 'New Chat') =>
      set((state) => {
        if (!state.conversations[id]) state.conversations[id] = createConversationState(id, title, state.model, state.variant) as any;
        state.activeConversationId = id;
        syncActiveConversation(state);
      }),

    upsertConversation: (conversation: ConversationState) =>
      set((state) => {
        conversation.contextRuntimeState = {
          ...(conversation.contextRuntimeState ?? { status: 'idle' }),
          contextWindow: conversation.model?.contextWindow,
        };
        state.conversations[conversation.sessionId] = conversation as any;
        if (!state.activeConversationId) state.activeConversationId = conversation.sessionId;
        if (state.activeConversationId === conversation.sessionId) syncActiveConversation(state);
      }),

    selectConversation: (id: string) =>
      set((state) => {
        if (!state.conversations[id]) return;
        state.conversations[id].hasUnread = false;
        state.activeConversationId = id;
        syncActiveConversation(state);
      }),

    removeConversation: (id: string) =>
      set((state) => {
        delete state.conversations[id];
        if (state.activeConversationId === id) {
          state.activeConversationId = Object.keys(state.conversations)[0] ?? null;
          syncActiveConversation(state);
        }
      }),

    setSessionId: (id: string) =>
      set((state) => {
        if (!state.conversations[id]) state.conversations[id] = createConversationState(id, 'New Chat', state.model, state.variant) as any;
        state.activeConversationId = id;
        syncActiveConversation(state);
      }),

    setLoading: (isLoading: boolean, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => {
          conversation.isLoading = isLoading;
          conversation.status = isLoading ? 'running' : 'idle';
        });
      }),

    addMessage: (message: MessageV2, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => {
          const existingIndex = conversation.messages.findIndex((m) => m.id === message.id);
          if (existingIndex >= 0) conversation.messages.splice(existingIndex, 1, message);
          else conversation.messages.push(message);
        });
      }),

    setModelMessages: (modelMessages: ModelMessage[], conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => {
          conversation.modelMessages = modelMessages as any;
        });
      }),

    undoToMessage: async (messageId: string) => {
      const state = get();
      const conversationId = state.activeConversationId;
      const conversation = conversationId ? state.conversations[conversationId] : null;
      if (!conversationId || !conversation) return;
      const messageIndex = conversation.messages.findIndex((m: MessageV2) => m.id === messageId);
      if (messageIndex === -1) return;

      const messagesToDiscard = conversation.messages.slice(messageIndex);
      const hasConflictedFile = messagesToDiscard.some(message => {
        if (message.role !== 'tool' || !message.content) return false;
        try {
          const target = parseFileToolPayload(message.content);
          return Boolean(target && conversation.fileReviews.find(review =>
            review.filePath === normalizePath(target.filePath) && review.status === 'conflicted'));
        } catch {
          return false;
        }
      });
      if (hasConflictedFile) {
        new Notice(t('agent:cannotUndoChangedFile'), 4000);
        return;
      }
      const discardedSnapshotIds = new Set<string>();
      for (let i = messagesToDiscard.length - 1; i >= 0; i--) {
        const msg = messagesToDiscard[i];
        collectSnapshotIdsFromToolMessage(msg, discardedSnapshotIds);
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

      const remainingMessages = conversation.messages.slice(0, messageIndex);
      const nextFileReviews = await rebuildFileReviewsAfterUndo(conversation.fileReviews, remainingMessages);
      const retainedSnapshotIds = collectRetainedSnapshotIds(remainingMessages, nextFileReviews);
      const snapshotLogic = SnapshotLogic.getInstance();

      for (const snapshotId of discardedSnapshotIds) {
        if (retainedSnapshotIds.has(snapshotId)) {
          continue;
        }

        try {
          await snapshotLogic.deleteSnapshot(snapshotId);
        } catch (e) {
          console.error('Failed to delete snapshot after undo', snapshotId, e);
        }
      }

      set((state) => {
        updateConversation(state, conversationId, current => {
        const currentIndex = current.messages.findIndex((m) => m.id === messageId);
        if (currentIndex === -1) return;
        current.messages = remainingMessages;
        
        // Count how many user messages are kept
        const userMessagesKept = current.messages.filter(m => m.role === 'user').length;
        
        // Truncate modelMessages based on user messages count
        // Each user message corresponds to one User message in modelMessages
        let userMessageCount = 0;
        let truncateIndex = current.modelMessages.length;
        
        for (let i = 0; i < current.modelMessages.length; i++) {
          if (current.modelMessages[i].role === 'user') {
            if (userMessageCount === userMessagesKept) {
              truncateIndex = i;
              break;
            }
            userMessageCount++;
          }
        }
        
        current.modelMessages = current.modelMessages.slice(0, truncateIndex) as any;
        const retainedTurnIds = new Set(current.messages.filter(message => message.role === 'user').map(message => message.id));
        if (current.contextCheckpoint && !retainedTurnIds.has(current.contextCheckpoint.coveredThroughTurnId)) {
          current.contextCheckpoint = undefined;
        }
        current.contextRuntimeState = {
          status: 'idle',
          contextWindow: current.model?.contextWindow,
        };
        current.isLoading = false;
        current.status = 'idle';
        current.fileReviews = nextFileReviews;
        if (current.abortController) {
          current.abortController.abort();
          current.abortController = null;
        }
        });
      });
      const updatedConversation = get().conversations[conversationId];
      if (updatedConversation) await SessionLogic.getInstance().saveSessionNow(updatedConversation);
    },

    setTitle: (title: string, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => { conversation.title = title; });
      }),

    setModel: (model: ModelConfig) =>
      set((state) => {
        state.model = model;
        state.contextRuntimeState = updateContextRuntimeForModelChange(
          state.contextRuntimeState,
          model.contextWindow,
        );
        for (const conversation of Object.values(state.conversations)) {
          conversation.model = model;
          conversation.contextRuntimeState = updateContextRuntimeForModelChange(
            conversation.contextRuntimeState,
            model.contextWindow,
          );
        }
        if (state.activeConversationId) syncActiveConversation(state);
      }),
    setVariant: (variant: ModelVariant | null) =>
      set((state) => {
        state.variant = variant;
        state.contextRuntimeState = updateContextRuntimeForModelChange(
          state.contextRuntimeState,
          state.model?.contextWindow,
        );
        for (const conversation of Object.values(state.conversations)) {
          conversation.variant = variant;
          conversation.contextRuntimeState = updateContextRuntimeForModelChange(
            conversation.contextRuntimeState,
            conversation.model?.contextWindow,
          );
        }
        if (state.activeConversationId) syncActiveConversation(state);
      }),
    setAbortController: (abortController: AbortController | null, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => { conversation.abortController = abortController; });
      }),

    setFileReviews: (fileReviews: FileReviewEntry[], conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => { conversation.fileReviews = fileReviews; });
      }),

    upsertFileReview: (fileReview: FileReviewEntry, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => {
          const existingIndex = conversation.fileReviews.findIndex((review) => review.filePath === fileReview.filePath);
          if (existingIndex >= 0) conversation.fileReviews[existingIndex] = fileReview;
          else conversation.fileReviews.push(fileReview);
        });
      }),

    removeFileReview: (filePath: string, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => {
          conversation.fileReviews = conversation.fileReviews.filter((review) => review.filePath !== filePath);
        });
      }),

    setActiveSkills: (skills: string[], conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => { conversation.activeSkills = skills; });
      }),

    setContextCheckpoint: (checkpoint: ContextCheckpoint | undefined, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => { conversation.contextCheckpoint = checkpoint as any; });
      }),

    setContextUsageCalibration: (calibration: ContextUsageCalibration | undefined, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => { conversation.contextUsageCalibration = calibration as any; });
      }),

    setContextRuntimeState: (runtimeState: ContextRuntimeState, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => { conversation.contextRuntimeState = runtimeState as any; });
      }),

    setUnread: (hasUnread: boolean, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => { conversation.hasUnread = hasUnread; });
      }),

    setUpdatedAt: (updatedAt: number, conversationId?: string) =>
      set((state) => {
        updateConversation(state, conversationId, conversation => { conversation.updatedAt = updatedAt; });
      }),

    resetForNewChat: () =>
      set((state) => {
        const id = state.activeConversationId;
        if (!id) return;
        state.conversations[id] = createConversationState(id, 'New Chat', state.model, state.variant) as any;
        syncActiveConversation(state);
      }),

    cleanupOldMessages: (keepCount: number = 50) =>
      set((state) => {
        updateConversation(state, undefined, conversation => {
          if (conversation.messages.length > keepCount) conversation.messages = conversation.messages.slice(-keepCount);
        });
      }),

    cleanupStreamingMessages: () =>
      set((state) => {
        updateConversation(state, undefined, conversation => {
          conversation.messages = conversation.messages.filter((message) => !message.isStreaming);
        });
      }),
  }))
);

// 保留向后兼容的单例 API（可选，用于非 React 代码）
export const agentStore = {
  getState: () => useAgentStore.getState(),
  setState: useAgentStore.setState,
  subscribe: useAgentStore.subscribe,
  reset: () => useAgentStore.setState(registryInitialState),
};
