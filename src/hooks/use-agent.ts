import { useAgentStore } from '../state/agent-state-impl';
import { AgentViewLogic } from '../logic/agent-view-logic';
import { FileReviewLogic } from '../logic/file-review-logic';
import { App } from 'obsidian';
import { Context, MessageV2, ModelConfig } from '../types';
import { useShallow } from 'zustand/react/shallow';

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
    }))
  );
}

export function useAgentLogic() {
  const agentLogic = AgentViewLogic.getInstance();
  const fileReviewLogic = FileReviewLogic.getInstance();

  return {
    sendMessage: (content: string, context: Context) => agentLogic.sendMessage(content, context),
    addMessage: (message: MessageV2) => agentLogic.addMessage(message),
    stopLoading: () => agentLogic.stopLoading(),
    setTitle: (title: string) => agentLogic.setTitle(title),
    resetForNewChat: (app: App | undefined) => agentLogic.resetForNewChat(app),
    finalizePendingReviews: () => agentLogic.finalizePendingReviews(),
    setModel: (model: ModelConfig) => agentLogic.setModel(model),
    setTitleModel: (model: ModelConfig) => agentLogic.setTitleModel(model),
    applyFileReview: (filePath: string) => fileReviewLogic.applyFile(filePath),
    applyReviewBlock: (filePath: string, blockId: string) => fileReviewLogic.applyBlock(filePath, blockId),
    rejectFileReview: (filePath: string) => fileReviewLogic.rejectFile(filePath),
    rejectReviewBlock: (filePath: string, blockId: string) => fileReviewLogic.rejectBlock(filePath, blockId),
    applyDerivedBlock: (filePath: string, block: { baselineStart: number; baselineEnd: number; patchText: string }) => fileReviewLogic.applyDerivedBlock(filePath, block),
    rejectDerivedBlock: (filePath: string, block: { baselineStart: number; baselineEnd: number; patchText: string }) => fileReviewLogic.rejectDerivedBlock(filePath, block),
    adoptFileReviewHead: (filePath: string) => fileReviewLogic.adoptCurrentAsHead(filePath),
    applyAllFileReviews: () => fileReviewLogic.applyAll(),
    rejectAllFileReviews: () => fileReviewLogic.rejectAll(),
    focusFileReview: (filePath: string) => fileReviewLogic.focusFile(filePath),
  };
}
