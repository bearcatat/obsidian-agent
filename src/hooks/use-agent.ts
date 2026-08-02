import { useAgentStore } from '../state/agent-state-impl';
import { AgentViewLogic } from '../logic/agent-view-logic';
import { FileReviewLogic } from '../logic/file-review-logic';
import { App } from 'obsidian';
import { ModelConfig, ModelVariant } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { UserMessage } from '@/messages/user-message';

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
    }))
  );
}

export function useAgentLogic() {
  const agentLogic = AgentViewLogic.getInstance();
  const fileReviewLogic = FileReviewLogic.getInstance();

  return {
    sendMessage: (message: UserMessage) => agentLogic.sendMessage(message),
    stopLoading: () => agentLogic.stopLoading(),
    resetForNewChat: (app: App | undefined) => agentLogic.resetForNewChat(app),
    finalizePendingReviews: () => agentLogic.finalizePendingReviews(),
    setModel: (model: ModelConfig, variant?: ModelVariant | null) => agentLogic.setModel(model, variant),
    applyFileReview: (filePath: string) => fileReviewLogic.applyFile(filePath),
    rejectFileReview: (filePath: string) => fileReviewLogic.rejectFile(filePath),
    applyDerivedBlock: (filePath: string, block: { baselineStart: number; baselineEnd: number; patchText: string }) => fileReviewLogic.applyDerivedBlock(filePath, block),
    rejectDerivedBlock: (filePath: string, block: { baselineStart: number; baselineEnd: number; patchText: string }) => fileReviewLogic.rejectDerivedBlock(filePath, block),
    applyAllFileReviews: () => fileReviewLogic.applyAll(),
    rejectAllFileReviews: () => fileReviewLogic.rejectAll(),
    focusFileReview: (filePath: string) => fileReviewLogic.focusFile(filePath),
  };
}
