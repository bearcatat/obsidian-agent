import type { ModelMessage } from "ai";
import type { BashApprovalConstraintItem, BashApprovalContext } from "@/types";
import { sanitizeBashApprovalText } from "./approval-evidence-provider";

const TOTAL_TEXT_BUDGET = 16_000;
const CURRENT_USER_BUDGET = 8_000;
const CONSTRAINT_BUDGET = 6_000;

function visibleText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (!part || typeof part !== "object") return "";
    const value = part as Record<string, unknown>;
    return value.type === "text" && typeof value.text === "string" ? value.text : "";
  }).filter(Boolean).join("\n");
}

function trimText(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  const half = Math.floor((limit - 32) / 2);
  return { text: `${text.slice(0, half)}\n...[truncated]...\n${text.slice(-half)}`, truncated: true };
}

export function buildBashApprovalContext(params: {
  conversationId: string;
  currentTurnId?: string;
  currentUserText: string;
  history: ModelMessage[];
  constraints: BashApprovalConstraintItem[];
  vaultPath?: string;
}): BashApprovalContext {
  const current = trimText(sanitizeBashApprovalText(params.currentUserText, params.vaultPath ?? ""), CURRENT_USER_BUDGET);
  let remaining = Math.max(0, TOTAL_TEXT_BUDGET - current.text.length);
  let authorizationContextTruncated = current.truncated;
  const priorUserMessages: BashApprovalContext["priorUserMessages"] = [];
  const recentAssistantUpdates: BashApprovalContext["recentAssistantUpdates"] = [];

  const priorUsers = params.history.filter((item) => item.role === "user").reverse();
  for (const message of priorUsers) {
    const text = sanitizeBashApprovalText(visibleText(message.content), params.vaultPath ?? "");
    if (!text) continue;
    if (remaining <= 0) {
      authorizationContextTruncated = true;
      break;
    }
    const item = trimText(text, remaining);
    priorUserMessages.push({ role: "user", text: item.text, truncated: item.truncated || undefined });
    remaining -= item.text.length;
    authorizationContextTruncated ||= item.truncated;
  }

  const assistants = params.history.filter((item) => item.role === "assistant").slice(-2);
  for (const message of assistants) {
    if (remaining <= 0) break;
    const text = sanitizeBashApprovalText(visibleText(message.content), params.vaultPath ?? "");
    if (!text) continue;
    const item = trimText(text, remaining);
    recentAssistantUpdates.push({ role: "assistant", text: item.text, truncated: item.truncated || undefined });
    remaining -= item.text.length;
  }

  let constraintRemaining = CONSTRAINT_BUDGET;
  const activeConstraints = params.constraints.flatMap((constraint) => {
    if (constraintRemaining <= 0) return [];
    const item = trimText(sanitizeBashApprovalText(constraint.text, params.vaultPath ?? ""), constraintRemaining);
    constraintRemaining -= item.text.length;
    return [{ ...constraint, text: item.text }];
  });

  return Object.freeze({
    conversationId: params.conversationId,
    currentTurnId: params.currentTurnId,
    currentUser: { role: "user" as const, text: current.text, truncated: current.truncated || undefined },
    priorUserMessages,
    recentAssistantUpdates,
    currentTurnActions: [],
    activeConstraints,
    cwdScope: "vault-root",
    authorizationContextTruncated,
  });
}
