import { useAgentStore } from '../state/agent-state-impl';
import { AgentViewLogic } from '../logic/agent-view-logic';
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
    }))
  );
}

export function useAgentLogic() {
  const agentLogic = AgentViewLogic.getInstance();

  return {
    sendMessage: (content: string, context: Context) => agentLogic.sendMessage(content, context),
    addMessage: (message: MessageV2) => agentLogic.addMessage(message),
    stopLoading: () => agentLogic.stopLoading(),
    setTitle: (title: string) => agentLogic.setTitle(title),
    resetForNewChat: (app: App | undefined) => agentLogic.resetForNewChat(app),
    setModel: (model: ModelConfig) => agentLogic.setModel(model),
    setTitleModel: (model: ModelConfig) => agentLogic.setTitleModel(model),
  };
}
