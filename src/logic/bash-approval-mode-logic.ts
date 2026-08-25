import { SessionLogic } from "@/logic/session-logic";
import { agentStore } from "@/state/agent-state-impl";
import { BashApprovalMode } from "@/types";

/**
 * Applies an explicit selection to the active conversation before persisting
 * that same immutable store snapshot. The in-memory choice remains active when
 * persistence fails so the current conversation never silently falls back.
 */
export function setActiveConversationBashApprovalMode(mode: BashApprovalMode): Promise<void> {
  const state = agentStore.getState();
  const conversationId = state.activeConversationId;

  state.setBashApprovalMode(mode, conversationId ?? undefined);
  if (!conversationId) return Promise.resolve();

  const updated = agentStore.getState().conversations[conversationId];
  return updated
    ? SessionLogic.getInstance().saveSessionNow(updated, true)
    : Promise.resolve();
}
