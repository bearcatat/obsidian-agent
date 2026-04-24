import { FileReviewEntry, MessageV2, ModelConfig, ModelVariant } from '../types';
import { ModelMessage } from 'ai';

export interface IAgentState {
  // 只保留状态属性
  readonly sessionId: string | null;
  readonly messages: MessageV2[];
  readonly modelMessages: ModelMessage[];
  readonly isLoading: boolean;
  readonly title: string;
  readonly model: ModelConfig | null;
  readonly abortController: AbortController | null;
  readonly fileReviews: FileReviewEntry[];
  readonly variant: ModelVariant | null;
}

export function clone(agentState: IAgentState): IAgentState {
  return {
    sessionId: agentState.sessionId,
    messages: agentState.messages,
    modelMessages: agentState.modelMessages,
    isLoading: agentState.isLoading,
    title: agentState.title,
    model: agentState.model,
    abortController: agentState.abortController,
    fileReviews: agentState.fileReviews,
    variant: agentState.variant,
  };
}

// 状态数据接口
export interface AgentStateData {
  sessionId: string | null;
  messages: MessageV2[];
  modelMessages: ModelMessage[];
  isLoading: boolean;
  title: string;
  model: ModelConfig | null;
  abortController: AbortController | null;
  fileReviews: FileReviewEntry[];
  variant: ModelVariant | null;
  activeSkills?: string[];
}
