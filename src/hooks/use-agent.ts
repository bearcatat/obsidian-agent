import { useState, useEffect } from 'react';
import { AgentState } from '../state/agent-state-impl';
import { AgentViewLogic } from '../logic/agent-view-logic';
import { clone, IAgentState } from '../state/agent-state';
import { App } from 'obsidian';
import { Context, MessageV2, ModelConfig } from '../types';

export function useAgentState(): IAgentState {
  const [state, setState] = useState<IAgentState>(() => AgentState.getInstance());

  useEffect(() => {
    const agentState = AgentState.getInstance();
    const unsubscribe = agentState.subscribe(() => {
      setState(clone(agentState));
    });
    return unsubscribe;
  }, []);

  return state;
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
