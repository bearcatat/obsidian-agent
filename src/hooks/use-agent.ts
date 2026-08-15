import { useAgentStore } from '../state/agent-state-impl';
import { AgentViewLogic } from '../logic/agent-view-logic';
import { FileReviewLogic } from '../logic/file-review-logic';
import { App } from 'obsidian';
import { ModelConfig, ModelVariant } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { UserMessage } from '@/messages/user-message';
import { agentStore } from '@/state/agent-state-impl';
import { SessionLogic } from '@/logic/session-logic';

// 导出 store hook，组件可以直接使用
export { useAgentStore };

// 保留向后兼容的 hook（从 store 中选择状态）
export function useAgentState() {
  return useAgentStore(
    useShallow((state) => ({
      messages: state.messages,
      isLoading: state.isLoading,
      title: state.title,
      model: state.model,
      abortController: state.abortController,
      fileReviews: state.fileReviews,
      variant: state.variant,
      contextCheckpoint: state.contextCheckpoint,
      contextRuntimeState: state.contextRuntimeState,
    }))
  );
}

export function useAgentLogic() {
  const agentLogic = AgentViewLogic.getInstance();
  const fileReviewLogic = FileReviewLogic.getInstance();
  const getActiveConversationId = () => agentStore.getState().activeConversationId ?? undefined;
  const persistConversation = async (conversationId?: string) => {
    if (!conversationId) return;
    const conversation = agentStore.getState().conversations[conversationId];
    if (conversation) await SessionLogic.getInstance().saveSessionNow(conversation);
  };

  return {
    sendMessage: (message: UserMessage) => agentLogic.sendMessage(message),
    stopLoading: () => agentLogic.stopLoading(),
    resetForNewChat: (app: App | undefined) => agentLogic.resetForNewChat(app),
    finalizePendingReviews: () => agentLogic.finalizePendingReviews(),
    setModel: (model: ModelConfig, variant?: ModelVariant | null) => agentLogic.setModel(model, variant),
    requestContextCompaction: (focus?: string) => agentLogic.requestContextCompaction(focus),
    retryContextCompaction: () => agentLogic.retryContextCompaction(),
    applyFileReview: async (filePath: string) => {
      const id = getActiveConversationId();
      fileReviewLogic.applyFile(filePath, id);
      await persistConversation(id);
    },
    rejectFileReview: async (filePath: string) => {
      const id = getActiveConversationId();
      await fileReviewLogic.rejectFile(filePath, id);
      await persistConversation(id);
    },
    applyDerivedBlock: async (filePath: string, block: { baselineStart: number; baselineEnd: number; patchText: string }) => {
      const id = getActiveConversationId();
      await fileReviewLogic.applyDerivedBlock(filePath, block, id);
      await persistConversation(id);
    },
    rejectDerivedBlock: async (filePath: string, block: { baselineStart: number; baselineEnd: number; patchText: string }) => {
      const id = getActiveConversationId();
      await fileReviewLogic.rejectDerivedBlock(filePath, block, id);
      await persistConversation(id);
    },
    applyAllFileReviews: async () => {
      const id = getActiveConversationId();
      fileReviewLogic.applyAll(id);
      await persistConversation(id);
    },
    rejectAllFileReviews: async () => {
      const id = getActiveConversationId();
      await fileReviewLogic.rejectAll(id);
      await persistConversation(id);
    },
    focusFileReview: (filePath: string) => fileReviewLogic.focusFile(filePath),
  };
}
