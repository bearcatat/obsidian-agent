import { TFile } from 'obsidian';
import { Message, MessageV2, ModelConfig } from '../types';

export interface IAgentState {
  // 只保留状态属性
  readonly messages: (Message | MessageV2)[];
  readonly isLoading: boolean;
  readonly activeNote: TFile | null;
  readonly isActiveNoteRemoved: boolean;
  readonly contextNotes: TFile[];
  readonly title: string;
  readonly model: ModelConfig | null;
  readonly abortController: AbortController | null;
}

export function clone(agentState: IAgentState): IAgentState {
  return {
    messages: agentState.messages,
    isLoading: agentState.isLoading,
    activeNote: agentState.activeNote,
    isActiveNoteRemoved: agentState.isActiveNoteRemoved,
    contextNotes: agentState.contextNotes,
    title: agentState.title,
    model: agentState.model,
    abortController: agentState.abortController,
  };
}

// 状态数据接口
export interface AgentStateData {
  messages: (Message | MessageV2)[];
  isLoading: boolean;
  activeNote: TFile | null;
  isActiveNoteRemoved: boolean;
  contextNotes: TFile[];
  title: string;
  model: ModelConfig | null;
  abortController: AbortController | null;
}
