import type {
  BashApprovalAuthorization,
  BashApprovalRisk,
  BashRulePermission,
  PermissionRule,
} from "@/types";

export type BashApprovalAction = "execute" | "ask" | "deny";

export function globMatches(command: string, pattern: string): boolean {
  const escaped = pattern.replace(/[\\^$+.[\]{}()|]/g, "\\$&");
  const regexPattern = `^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`;
  return new RegExp(regexPattern, "i").test(command);
}

export function resolveRulePermission(command: string, rules: PermissionRule[]): BashRulePermission {
  const matches = rules.filter((rule) => globMatches(command, rule.pattern));
  if (matches.some((rule) => rule.permission === "deny")) return "deny";
  if (matches.some((rule) => rule.permission === "allow")) return "allow";
  return "ask";
}

export function resolveAiApprovalAction(
  risk: BashApprovalRisk,
  authorization: BashApprovalAuthorization,
): BashApprovalAction {
  if (risk === "critical" || authorization === "conflicts") return "deny";
  if (authorization === "unclear") return "ask";
  if (risk === "high" && authorization !== "explicit") return "ask";
  return "execute";
}

export function extractCommandGroupPattern(command: string): string {
  const firstToken = command.trim().split(/\s+/)[0];
  return `${firstToken} *`;
}
