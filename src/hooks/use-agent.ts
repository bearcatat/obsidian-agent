import { useState, useEffect } from 'react';
import { AgentState } from '../state/agent-state-impl';
import { AgentViewLogic } from '../logic/agent-view-logic';
import { clone, IAgentState } from '../state/agent-state';
import { App, TFile } from 'obsidian';
import { ModelConfig } from '../types';

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
    sendMessage: (content: string) => agentLogic.sendMessage(content),
    stopLoading: () => agentLogic.stopLoading(),
    setActiveNote: (activeNote: TFile | null) => agentLogic.setActiveNote(activeNote),
    removeContextNote: (path: string) => agentLogic.removeContextNote(path),
    addContextNote: (note: TFile, isActive: boolean) => agentLogic.addContextNote(note, isActive),
    setTitle: (title: string) => agentLogic.setTitle(title),
    resetForNewChat: (app: App | undefined) => agentLogic.resetForNewChat(app),
    setModel: (model: ModelConfig) => agentLogic.setModel(model),
  };
}
