import { ToolSet } from "ai";

export interface ToolContext {
  allTools: ToolSet;
}

export interface AgentToolContext {
  conversationId: string;
  addMessage: (message: import('@/types').MessageV2) => void;
  model: import('@/types').ModelConfig;
  variant: import('@/types').ModelVariant | null;
  activateSkill: (name: string) => boolean;
  currentTurnId?: string;
  currentUserText?: string;
  bashApprovalContext?: Readonly<import('@/types').BashApprovalContext>;
  /** Host-only path used to sanitize approval data; never sent to a Provider. */
  bashApprovalVaultPath?: string;
}
