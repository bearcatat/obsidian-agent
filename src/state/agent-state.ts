import { MessageV2, ModelConfig } from '../types';

export interface IAgentState {
  // 只保留状态属性
  readonly messages: MessageV2[];
  readonly isLoading: boolean;
  readonly title: string;
  readonly model: ModelConfig | null;
  readonly abortController: AbortController | null;
}

export function clone(agentState: IAgentState): IAgentState {
  return {
    messages: agentState.messages,
    isLoading: agentState.isLoading,
    title: agentState.title,
    model: agentState.model,
    abortController: agentState.abortController,
  };
}

// 状态数据接口
export interface AgentStateData {
  messages: MessageV2[];
  isLoading: boolean;
  title: string;
  model: ModelConfig | null;
  abortController: AbortController | null;
}
