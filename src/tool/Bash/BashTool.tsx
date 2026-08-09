/// <reference types="node" />
import { tool } from "ai";
import { z } from "zod";
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { BashToolMessageCard } from "@/ui/components/agent-view/messages/message/bash-tool-message-card";
import type {
  BashAuthorizationSummary,
  BashCommand,
  BashRulePermission,
  MessageV2,
} from "@/types";
import type { AgentToolContext } from "@/tool/ToolContext";
import { settingsStore } from "@/state/settings-state-impl";
import { cloneDefaultBashPermissions, normalizeBashPermissionConfig } from "../BuiltinTools";
import { persistSettingsStore } from "@/logic/settings-persistence";
import { localBashExecutor } from "./execute-command";
import { DESCRIPTION } from "./prompts";
import { checkBashHardGuard } from "./bash-hard-guard";
import {
  extractCommandGroupPattern,
  resolveAiApprovalAction,
  resolveRulePermission,
} from "./bash-authorization";
import { reviewBashCommand } from "./bash-approval-reviewer";

export const toolName = "bash";
type DisplayDecision = "apply" | "reject" | "allow" | "deny" | null;
type HumanDecision = "apply" | "reject" | "allow" | "deny" | "allow_group" | "deny_group" | "cancel";

function resultPayload(command: string, output: string, exitCode: number, error: string): string {
  return JSON.stringify({
    success: exitCode === 0 ? "Command executed successfully" : "Command failed",
    command,
    output,
    exitCode,
    error,
  });
}

function deniedResult(command: string, reason: string): string {
  return JSON.stringify({ success: "Command was not executed", command, output: "", exitCode: 1, error: reason });
}

export const BashTool = tool({
  title: toolName,
  description: DESCRIPTION,
  inputSchema: z.object({
    command: z.string().describe("The shell command to execute"),
    timeout: z.number().optional().describe("Timeout in milliseconds (default: 60000)"),
  }),
  execute: async ({ command, timeout }, { toolCallId, experimental_context, abortSignal }) => {
    const context = experimental_context as AgentToolContext;
    const toolMessage = ToolMessage.from(toolName, toolCallId);
    const app = getGlobalApp();
    let vaultPath = "";
    try {
      vaultPath = (app.vault.adapter as { basePath?: string }).basePath ?? "";
    } catch {
      vaultPath = "";
    }
    const bashCommand: BashCommand = {
      id: toolCallId ?? "",
      command,
      workingDirectory: vaultPath || "/",
    };
    const config = normalizeBashPermissionConfig(settingsStore.getState().bashPermissions ?? cloneDefaultBashPermissions());

    const publish = (
      commandState: BashCommand,
      answered: boolean,
      decision: DisplayDecision,
      authorization: BashAuthorizationSummary,
      handlers: Partial<Record<"apply" | "reject" | "allow" | "deny" | "allowGroup" | "denyGroup", () => void>> = {},
      pendingLabel?: string,
    ) => {
      toolMessage.setChildren(
        <BashToolMessageCard
          bashCommand={commandState}
          origin_answered_state={answered}
          decision={decision}
          authorization={authorization}
          pendingLabel={pendingLabel}
          onApply={handlers.apply}
          onReject={handlers.reject}
          onAlwaysAllow={handlers.allow}
          onAlwaysDeny={handlers.deny}
          onAlwaysAllowGroup={handlers.allowGroup}
          onAlwaysDenyGroup={handlers.denyGroup}
        />,
      );
      if (answered) toolMessage.close();
      context.addMessage(toolMessage as MessageV2);
    };

    const closeWithoutExecution = (authorization: BashAuthorizationSummary, reason: string, decision: DisplayDecision = "reject") => {
      const finalCommand = { ...bashCommand, error: reason };
      toolMessage.setContent(JSON.stringify({
        toolName,
        decision,
        bashCommand: finalCommand,
        authorization,
        success: false,
        isCancelled: true,
        message: reason,
      }));
      publish(finalCommand, true, decision, authorization);
      return deniedResult(command, reason);
    };

    const hardGuard = checkBashHardGuard(command, vaultPath);
    if (hardGuard.blocked) {
      return closeWithoutExecution({
        policy: config.policy,
        source: "hard-block",
        risk: "critical",
        reason: `${hardGuard.code}: ${hardGuard.reason}`,
        isolation: localBashExecutor.isolation,
      }, hardGuard.reason, "deny");
    }

    let authorization: BashAuthorizationSummary;
    let shouldAsk = false;
    let allowRemember = false;

    if (config.policy === "direct") {
      authorization = {
        policy: "direct",
        source: "direct",
        reason: "Direct execution policy",
        isolation: localBashExecutor.isolation,
      };
    } else if (config.policy === "rules") {
      const permission = resolveRulePermission(command, config.rules);
      authorization = {
        policy: "rules",
        source: "rule",
        reason: permission === "ask" ? "No allow or deny rule resolved the command" : `Rule result: ${permission}`,
        isolation: localBashExecutor.isolation,
      };
      if (permission === "deny") return closeWithoutExecution(authorization, "This command is denied by Bash permission rules", "deny");
      shouldAsk = permission === "ask";
      allowRemember = shouldAsk;
    } else {
      authorization = {
        policy: "ai",
        source: "ai",
        risk: "unknown",
        reason: "Evaluating command with the current conversation model",
        isolation: localBashExecutor.isolation,
      };
      publish(bashCommand, false, null, authorization, {}, "Evaluating command");
      try {
        const review = await reviewBashCommand(command, context, abortSignal, context.bashApprovalVaultPath ?? vaultPath);
        authorization = { ...authorization, ...review };
        const action = resolveAiApprovalAction(review.risk, review.authorization);
        if (action === "deny") {
          const reason = review.authorization === "conflicts"
            ? `Command conflicts with an active user constraint: ${review.reason}`
            : `Critical-risk command rejected: ${review.reason}`;
          return closeWithoutExecution(authorization, reason, "deny");
        }
        shouldAsk = action === "ask";
      } catch (error) {
        if (abortSignal?.aborted) {
          return closeWithoutExecution({ ...authorization, reason: "Approval cancelled" }, "Command approval was cancelled");
        }
        authorization = {
          ...authorization,
          risk: "unknown",
          authorization: "unclear",
          reason: "AI review unavailable; manual confirmation is required",
        };
        shouldAsk = true;
      }
    }

    const saveRule = async (permission: BashRulePermission, pattern: string) => {
      if (abortSignal?.aborted) throw new Error("Command approval was cancelled");
      const current = normalizeBashPermissionConfig(settingsStore.getState().bashPermissions);
      const rules = current.rules.filter((rule) => rule.pattern !== pattern);
      rules.push({ pattern, permission });
      const next = { ...current, rules };

      // Persist the candidate before publishing it to the live store. A failed
      // save must not leave a remembered rule active in the current session.
      try {
        await persistSettingsStore({ bashPermissions: next });
      } catch (error) {
        // saveData() should be atomic, but restore the previous snapshot as a
        // best-effort recovery in case the adapter reported a partial write.
        try {
          await persistSettingsStore({ bashPermissions: current });
        } catch (rollbackError) {
          console.error("Failed to roll back Bash permission rule after save failure:", rollbackError);
        }
        throw error;
      }

      // Cancellation can happen while saveData() is awaiting the adapter. Do
      // not retain a rule that belongs to a cancelled approval action.
      if (abortSignal?.aborted) {
        try {
          await persistSettingsStore({ bashPermissions: current });
        } catch (rollbackError) {
          console.error("Failed to roll back Bash permission rule after cancellation:", rollbackError);
        }
        throw new Error("Command approval was cancelled");
      }

      settingsStore.getState().setBashPermissions(next);
    };

    if (shouldAsk) {
      const decision = await new Promise<HumanDecision>((resolve) => {
        let settled = false;
        const settle = (value: HumanDecision) => {
          if (settled) return;
          settled = true;
          abortSignal?.removeEventListener("abort", cancel);
          resolve(value);
        };
        const cancel = () => settle("cancel");
        abortSignal?.addEventListener("abort", cancel, { once: true });
        if (abortSignal?.aborted) {
          cancel();
          return;
        }
        publish(bashCommand, false, null, authorization, {
          apply: () => settle("apply"),
          reject: () => settle("reject"),
          ...(allowRemember ? {
            allow: () => settle("allow"),
            deny: () => settle("deny"),
            allowGroup: () => settle("allow_group"),
            denyGroup: () => settle("deny_group"),
          } : {}),
        }, authorization.reason);
      });

      if (decision === "cancel") return closeWithoutExecution({ ...authorization, source: "human", reason: "Approval cancelled" }, "Command approval was cancelled");
      if (decision === "reject") return closeWithoutExecution({ ...authorization, source: "human", reason: "User rejected the command" }, "User rejected the command");
      if (decision === "deny" || decision === "deny_group") {
        const pattern = decision === "deny_group" ? extractCommandGroupPattern(command) : command;
        try {
          await saveRule("deny", pattern);
        } catch (error) {
          return closeWithoutExecution({ ...authorization, source: "human", reason: "Failed to save the deny rule" }, error instanceof Error ? error.message : "Failed to save the deny rule");
        }
        return closeWithoutExecution({ ...authorization, source: "human", reason: "User denied and remembered this command pattern" }, "User denied and remembered this command pattern", "deny");
      }
      if (decision === "allow" || decision === "allow_group") {
        const pattern = decision === "allow_group" ? extractCommandGroupPattern(command) : command;
        try {
          await saveRule("allow", pattern);
        } catch (error) {
          return closeWithoutExecution({ ...authorization, source: "human", reason: "Failed to save the allow rule; command was not executed" }, error instanceof Error ? error.message : "Failed to save the allow rule");
        }
      }
      authorization = { ...authorization, source: "human", reason: decision === "apply" ? "User approved one execution" : "User approved and saved a rule" };
    }

    if (abortSignal?.aborted) return closeWithoutExecution({ ...authorization, reason: "Execution cancelled" }, "Command execution was cancelled");
    const result = await localBashExecutor.execute({ command, cwd: vaultPath, timeout }, abortSignal);
    const finalCommand: BashCommand = { ...bashCommand, ...result };
    const displayDecision: DisplayDecision = authorization.source === "human" ? "apply" : "allow";
    toolMessage.setContent(JSON.stringify({
      toolName,
      decision: displayDecision,
      bashCommand: finalCommand,
      authorization,
      success: result.exitCode === 0,
      isCancelled: false,
    }));
    publish(finalCommand, true, displayDecision, authorization);
    return resultPayload(command, result.output, result.exitCode, result.error);
  },
});
