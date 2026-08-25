/// <reference types="node" />
import { tool } from 'ai';
import { z } from 'zod';
import { ToolMessage } from '@/messages/tool-message';
import { getGlobalApp } from '@/utils';
import { BashToolMessageCard } from '@/ui/components/agent-view/messages/message/bash-tool-message-card';
import type { BashAuthorizationSummary, BashCommand, BashExecutionAttempt, BashOutcomeStatus, MessageV2 } from '@/types';
import type { AgentToolContext } from '@/tool/ToolContext';
import { settingsStore } from '@/state/settings-state-impl';
import { t } from '@/i18n';
import { DESCRIPTION } from './prompts';
import { checkBashHardGuard } from './bash-hard-guard';
import { BashElevationCoordinator, isWindowsPowerShellHttpsCompatibilityFailure } from './BashElevationCoordinator';
import { executeSandboxedBash, isBashSandboxPlatformSupported, type SandboxedExecutionResult } from './sandbox-executor';

export const toolName = 'bash';
type DisplayDecision = 'apply' | 'reject' | 'allow' | 'deny' | null;
type HumanDecision = 'apply' | 'reject' | 'cancel';

function resultPayload(command: string, output: string, exitCode: number, error: string, status: BashOutcomeStatus): string {
  return JSON.stringify({ success: status === 'success' ? 'Command executed successfully' : 'Command was not executed or failed', command, output, exitCode, error, status });
}

function deniedResult(command: string, reason: string, status: BashOutcomeStatus): string {
  return resultPayload(command, '', 1, reason, status);
}

function outcomeDecision(status: BashOutcomeStatus): DisplayDecision {
  if (status === 'success') return 'allow';
  if (status === 'command-failed') return 'apply';
  return 'deny';
}

export const BashTool = tool({
  title: toolName,
  description: DESCRIPTION,
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default: 60000)'),
    sandbox_permissions: z.literal('full-access').optional().describe('One-call complete-access request; never request an intermediate mode'),
    justification: z.string().max(500).optional().describe('Why this one call needs complete access'),
  }),
  execute: async ({ command, timeout, sandbox_permissions, justification }, { toolCallId, experimental_context, abortSignal }) => {
    const context = experimental_context as AgentToolContext;
    const toolMessage = ToolMessage.from(toolName, toolCallId);
    const app = getGlobalApp();
    const vaultPath = (app.vault.adapter as { basePath?: string }).basePath ?? '';
    const configuredMode = settingsStore.getState().bashSandbox.mode;
    const approvalMode = context.bashApprovalMode ?? 'ask';
    const backend = process.platform === 'win32' ? 'windows-acl' : process.platform === 'darwin' ? 'seatbelt' : 'unsupported';
    const bashCommand: BashCommand = { id: toolCallId ?? '', command, workingDirectory: vaultPath || '/' };
    const attempts: BashExecutionAttempt[] = [];
    let terminalResult: string | undefined;
    const initialAuthorization = (source: BashAuthorizationSummary['source'], reason: string, effectiveMode = configuredMode): BashAuthorizationSummary => ({
      approvalMode,
      source,
      reason,
      configuredMode,
      effectiveMode,
      backend,
    });

    const publish = (
      commandState: BashCommand,
      answered: boolean,
      decision: DisplayDecision,
      authorization: BashAuthorizationSummary,
      handlers: Partial<Record<'apply' | 'reject', () => void>> = {},
      pendingLabel?: string,
    ) => {
      toolMessage.setChildren(<BashToolMessageCard
        bashCommand={commandState}
        origin_answered_state={answered}
        decision={decision}
        authorization={authorization}
        pendingLabel={pendingLabel}
        onApply={handlers.apply}
        onReject={handlers.reject}
      />);
      if (answered) toolMessage.close();
      // addMessage upserts by message id, so every progress update replaces
      // this one streaming card instead of appending a second tool message.
      context.addMessage(toolMessage as MessageV2);
    };

    const closeWithoutExecution = (authorization: BashAuthorizationSummary, reason: string, status: BashOutcomeStatus) => {
      const finalCommand: BashCommand = { ...bashCommand, error: reason, outcome: status, attempts: [...attempts], retryCount: attempts.length > 1 ? 1 : 0 };
      const finalAuthorization = { ...authorization, outcome: status, reason };
      toolMessage.setContent(JSON.stringify({ toolName, decision: outcomeDecision(status), bashCommand: finalCommand, authorization: finalAuthorization, success: false, isCancelled: status === 'cancelled', status }));
      publish(finalCommand, true, outcomeDecision(status), finalAuthorization);
      terminalResult = deniedResult(command, reason, status);
      return terminalResult;
    };

    const finalize = (result: SandboxedExecutionResult, authorization: BashAuthorizationSummary) => {
      const status = result.status;
      const finalCommand: BashCommand = { ...bashCommand, shell: result.shell, output: result.output, exitCode: result.exitCode, error: result.error, outcome: status, attempts: [...attempts], retryCount: attempts.length > 1 ? 1 : 0 };
      const finalAuthorization: BashAuthorizationSummary = { ...authorization, backend: result.backend, outcome: status };
      toolMessage.setContent(JSON.stringify({ toolName, decision: outcomeDecision(status), bashCommand: finalCommand, authorization: finalAuthorization, success: status === 'success', isCancelled: status === 'cancelled', status }));
      publish(finalCommand, true, outcomeDecision(status), finalAuthorization);
      return resultPayload(command, result.output, result.exitCode, result.error, status);
    };

    const waitForHuman = async (authorization: BashAuthorizationSummary): Promise<HumanDecision> => await new Promise<HumanDecision>((resolve) => {
      let settled = false;
      const settle = (value: HumanDecision) => {
        if (!settled) {
          settled = true;
          abortSignal?.removeEventListener('abort', cancel);
          resolve(value);
        }
      };
      const cancel = () => settle('cancel');
      abortSignal?.addEventListener('abort', cancel, { once: true });
      if (abortSignal?.aborted) return cancel();
      publish(
        bashCommand,
        false,
        null,
        authorization,
        { apply: () => settle('apply'), reject: () => settle('reject') },
        t('agent:bashWaitingForHumanApproval'),
      );
    });

    if (!isBashSandboxPlatformSupported()) return closeWithoutExecution(initialAuthorization('hard-guard', 'Bash is available only on Windows and macOS Desktop'), 'Bash is unavailable on this platform', 'sandbox-unavailable');
    if (sandbox_permissions && configuredMode === 'full-access') return closeWithoutExecution(initialAuthorization('hard-guard', 'Complete access is already selected'), 'sandbox_permissions cannot elevate an already complete-access sandbox', 'safety-denied');
    if (sandbox_permissions && !justification?.trim()) return closeWithoutExecution(initialAuthorization('hard-guard', 'A complete-access request needs justification'), 'A complete-access request requires justification', 'safety-denied');

    const hardGuard = checkBashHardGuard(command, vaultPath);
    if (hardGuard.blocked) return closeWithoutExecution(initialAuthorization('hard-guard', `${hardGuard.code}: ${hardGuard.reason}`), hardGuard.reason, 'safety-denied');

    const coordinator = new BashElevationCoordinator({
      command,
      vaultPath,
      configuredMode,
      approvalMode,
      context,
      backend,
      justification,
      signal: abortSignal,
      onReviewStart: () => publish(
        bashCommand,
        false,
        null,
        initialAuthorization('model', 'Reviewing one complete-access elevation'),
        {},
        t('agent:bashIntelligentApproval'),
      ),
    });
    const resolveElevation = async (trigger: 'requested-capability' | 'sandbox-denied' | 'powershell-https-compatibility'): Promise<BashAuthorizationSummary | undefined> => {
      let resolution;
      try {
        resolution = await coordinator.request(trigger);
      } catch (error) {
        if (abortSignal?.aborted) closeWithoutExecution(initialAuthorization('human', 'Command approval was cancelled'), 'Command approval was cancelled', 'cancelled');
        return undefined;
      }
      if (resolution.decision === 'deny') {
        closeWithoutExecution(resolution.authorization, resolution.authorization.reason ?? 'AI denied the complete-access request', 'model-denied');
        return undefined;
      }
      if (resolution.decision === 'ask') {
        const human = await waitForHuman(resolution.authorization);
        if (human === 'cancel') {
          closeWithoutExecution({ ...resolution.authorization, source: 'human' }, 'Command approval was cancelled', 'cancelled');
          return undefined;
        }
        if (human === 'reject') {
          coordinator.rememberHumanDeny(trigger, 'User rejected the complete-access request');
          closeWithoutExecution({ ...resolution.authorization, source: 'human' }, 'User rejected the complete-access request', 'human-denied');
          return undefined;
        }
        return { ...resolution.authorization, source: 'human', reason: 'User approved one complete-access execution' };
      }
      return resolution.authorization;
    };

    let authorization = initialAuthorization('automatic', 'The command stays within the configured write boundary');
    let result: SandboxedExecutionResult;
    const executeAttempt = async (mode: typeof configuredMode, trigger?: NonNullable<BashAuthorizationSummary['elevation']>['trigger']): Promise<SandboxedExecutionResult> => {
      publish(
        bashCommand,
        false,
        null,
        { ...authorization, effectiveMode: mode },
        {},
        t('agent:bashExecuting'),
      );
      const next = await executeSandboxedBash({ command, cwd: vaultPath, timeout, mode }, abortSignal);
      attempts.push({
        index: attempts.length === 0 ? 0 : 1,
        mode,
        trigger,
        backend: next.backend,
        shell: next.shell,
        status: next.status,
        exitCode: next.exitCode,
        output: next.output,
        error: next.error,
      });
      return next;
    };

    if (sandbox_permissions) {
      const elevated = await resolveElevation('requested-capability');
      if (!elevated) return terminalResult ?? deniedResult(command, 'Complete-access elevation was not approved', abortSignal?.aborted ? 'cancelled' : 'approval-required');
      authorization = elevated;
      if (abortSignal?.aborted) return closeWithoutExecution(authorization, 'Command execution was cancelled', 'cancelled');
      result = await executeAttempt('full-access', 'requested-capability');
      return finalize(result, authorization);
    }

    if (abortSignal?.aborted) return closeWithoutExecution(authorization, 'Command execution was cancelled', 'cancelled');
    result = await executeAttempt(configuredMode);
    const compatibilityElevation = isWindowsPowerShellHttpsCompatibilityFailure({ command, status: result.status, backend: result.backend, configuredMode, error: result.error });
    const elevationTrigger = configuredMode !== 'full-access'
      ? result.status === 'sandbox-denied' ? 'sandbox-denied'
        : compatibilityElevation ? 'powershell-https-compatibility'
          : undefined
      : undefined;
    if (!elevationTrigger) return finalize(result, authorization);

    const elevated = await resolveElevation(elevationTrigger);
    if (!elevated) return terminalResult ?? deniedResult(command, 'Complete-access elevation was not approved', abortSignal?.aborted ? 'cancelled' : 'approval-required');
    authorization = elevated;
    if (abortSignal?.aborted) return closeWithoutExecution(authorization, 'Command execution was cancelled', 'cancelled');
    // Exactly one retry is possible: full-access results never re-enter this branch.
    result = await executeAttempt('full-access', elevationTrigger);
    return finalize(result, authorization);
  },
});
