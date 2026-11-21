/// <reference types="node" />
import { tool } from 'ai';
import { z } from 'zod';
import { ToolMessage } from '@/messages/tool-message';
import { getGlobalApp } from '@/utils';
import { BashToolMessageCard } from '@/ui/components/agent-view/messages/message/bash-tool-message-card';
import type { BashAuthorizationSummary, BashCommand, BashExecutionAttempt, BashOutcomeStatus, MessageV2 } from '@/types';
import type { AgentToolContext } from '@/tool/ToolContext';
import { settingsStore } from '@/state/settings-state-impl';
import { isSettingsPersistenceReady, persistSettingsStore } from '@/logic/settings-persistence';
import { t } from '@/i18n';
import { DESCRIPTION } from './prompts';
import { checkBashHardGuard } from './bash-hard-guard';
import { reviewBashCommand } from './bash-approval-reviewer';
import { resolveModelApprovalAction } from './bash-authorization';
import { executeCommand, isBashHostPlatformSupported, type ExecuteResult } from './execute-command';

export const toolName = 'bash';
type DisplayDecision = 'apply' | 'reject' | 'allow' | 'deny' | null;
type HumanDecision = 'apply' | 'reject' | 'cancel';

function resultPayload(command: string, result: ExecuteResult, status: BashOutcomeStatus): string {
  return JSON.stringify({ success: status === 'success' ? 'Command executed successfully' : 'Command was not executed or failed', command, output: result.output, exitCode: result.exitCode, error: result.error, status });
}

export const BashTool = tool({
  title: toolName,
  description: DESCRIPTION,
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default: 60000)'),
  }),
  execute: async ({ command, timeout }, { toolCallId, experimental_context, abortSignal }) => {
    const context = experimental_context as AgentToolContext;
    const toolMessage = ToolMessage.from(toolName, toolCallId);
    const app = getGlobalApp();
    const vaultPath = (app.vault.adapter as { basePath?: string }).basePath ?? '';
    const approvalMode = context.bashApprovalMode ?? 'ask';
    const bashCommand: BashCommand = { id: toolCallId ?? '', command, workingDirectory: vaultPath || '/' };
    const attempts: BashExecutionAttempt[] = [];
    let cardRevision = 0;

    const authorization = (source: BashAuthorizationSummary['source'], reason: string): BashAuthorizationSummary => ({ approvalMode, source, reason, backend: 'host' });
    const publish = (commandState: BashCommand, answered: boolean, decision: DisplayDecision, summary: BashAuthorizationSummary, handlers: Partial<Record<'apply' | 'reject', () => void>> = {}, pendingLabel?: string) => {
      // Each stage needs fresh card state, especially when two approvals follow one another.
      toolMessage.setChildren(<BashToolMessageCard key={++cardRevision} bashCommand={commandState} origin_answered_state={answered} decision={decision} authorization={summary} pendingLabel={pendingLabel} onApply={handlers.apply} onReject={handlers.reject} />);
      if (answered) toolMessage.close();
      context.addMessage(toolMessage as MessageV2);
    };
    const closeWithoutExecution = (summary: BashAuthorizationSummary, reason: string, status: BashOutcomeStatus) => {
      const finalCommand: BashCommand = { ...bashCommand, error: reason, outcome: status, attempts };
      const finalAuthorization = { ...summary, outcome: status, reason };
      toolMessage.setContent(JSON.stringify({ toolName, decision: 'deny', bashCommand: finalCommand, authorization: finalAuthorization, success: false, isCancelled: status === 'cancelled', status }));
      publish(finalCommand, true, 'deny', finalAuthorization);
      return JSON.stringify({ success: 'Command was not executed or failed', command, output: '', exitCode: 1, error: reason, status });
    };
    const waitForHuman = (summary: BashAuthorizationSummary, pendingLabel: string) => new Promise<HumanDecision>((resolve) => {
      let settled = false;
      const settle = (value: HumanDecision) => {
        if (settled) return;
        settled = true;
        abortSignal?.removeEventListener('abort', cancel);
        resolve(value);
      };
      const cancel = () => settle('cancel');
      abortSignal?.addEventListener('abort', cancel, { once: true });
      if (abortSignal?.aborted) return cancel();
      publish(bashCommand, false, null, summary, { apply: () => settle('apply'), reject: () => settle('reject') }, pendingLabel);
    });

    if (!isBashHostPlatformSupported()) return closeWithoutExecution(authorization('hard-guard', 'Bash is available only on Windows and macOS Desktop'), 'Bash is unavailable on this platform', 'execution-unavailable');
    const hardGuard = checkBashHardGuard(command, vaultPath);
    if (hardGuard.blocked) return closeWithoutExecution(authorization('hard-guard', `${hardGuard.code}: ${hardGuard.reason}`), hardGuard.reason, 'safety-denied');

    if (!settingsStore.getState().bashExecution.hostAccessAcknowledged) {
      const migrationAuthorization = authorization('human', t('agent:bashHostAccessNotice'));
      const decision = await waitForHuman(migrationAuthorization, t('agent:bashHostAccessConfirmation'));
      if (decision === 'cancel') return closeWithoutExecution(migrationAuthorization, 'Command approval was cancelled', 'cancelled');
      if (decision === 'reject') return closeWithoutExecution(migrationAuthorization, 'Local command execution was not enabled', 'human-denied');
      if (!isSettingsPersistenceReady()) return closeWithoutExecution(migrationAuthorization, 'Local command execution acknowledgement could not be saved', 'approval-required');
      try {
        await persistSettingsStore({ bashExecution: { hostAccessAcknowledged: true } });
        settingsStore.getState().setBashExecution({ hostAccessAcknowledged: true });
      } catch (error) {
        return closeWithoutExecution(migrationAuthorization, error instanceof Error ? error.message : 'Local command execution acknowledgement could not be saved', 'approval-required');
      }
    }

    let summary: BashAuthorizationSummary = authorization('automatic', 'Command approval is automatic for this conversation');
    if (approvalMode === 'ask') {
      const decision = await waitForHuman(authorization('human', 'The conversation requires human approval for every command'), t('agent:bashWaitingForHumanApproval'));
      if (decision === 'cancel') return closeWithoutExecution(authorization('human', 'Command approval was cancelled'), 'Command approval was cancelled', 'cancelled');
      if (decision === 'reject') return closeWithoutExecution(authorization('human', 'User rejected the command'), 'User rejected the command', 'human-denied');
      summary = authorization('human', 'User approved one execution');
    } else if (approvalMode === 'intelligent') {
      summary = authorization('model', 'Reviewing command approval');
      publish(bashCommand, false, null, summary, {}, t('agent:bashIntelligentApproval'));
      try {
        const review = await reviewBashCommand(command, context, abortSignal, context.bashApprovalVaultPath ?? vaultPath);
        summary = { ...summary, ...review };
        const decision = resolveModelApprovalAction(review);
        if (decision === 'deny') return closeWithoutExecution(summary, review.reason, 'model-denied');
        if (decision === 'ask') {
          const human = await waitForHuman(summary, t('agent:bashWaitingForHumanApproval'));
          if (human === 'cancel') return closeWithoutExecution({ ...summary, source: 'human' }, 'Command approval was cancelled', 'cancelled');
          if (human === 'reject') return closeWithoutExecution({ ...summary, source: 'human' }, 'User rejected the command', 'human-denied');
          summary = { ...summary, source: 'human', reason: 'User approved one execution' };
        }
      } catch (error) {
        if (abortSignal?.aborted) return closeWithoutExecution(summary, 'Command approval was cancelled', 'cancelled');
        summary = { ...summary, source: 'human', risk: 'unknown', authorization: 'unclear', reason: 'Intelligent approval is unavailable, so human approval is required' };
        const human = await waitForHuman(summary, t('agent:bashWaitingForHumanApproval'));
        if (human === 'cancel') return closeWithoutExecution(summary, 'Command approval was cancelled', 'cancelled');
        if (human === 'reject') return closeWithoutExecution(summary, 'User rejected the command', 'human-denied');
        summary = { ...summary, reason: 'User approved one execution' };
      }
    }

    if (abortSignal?.aborted) return closeWithoutExecution(summary, 'Command execution was cancelled', 'cancelled');
    publish(bashCommand, false, null, summary, {}, t('agent:bashExecuting'));
    const result = await executeCommand(command, vaultPath, timeout, abortSignal);
    const status: BashOutcomeStatus = result.error === 'Cancelled' ? 'cancelled' : result.exitCode === 0 && !result.startupFailed ? 'success' : 'command-failed';
    attempts.push({ index: 0, backend: 'host', shell: result.shell, status, exitCode: result.exitCode, output: result.output, error: result.error });
    const finalCommand: BashCommand = { ...bashCommand, shell: result.shell, output: result.output, exitCode: result.exitCode, error: result.error, outcome: status, attempts };
    const finalAuthorization = { ...summary, outcome: status };
    toolMessage.setContent(JSON.stringify({ toolName, decision: status === 'success' ? 'allow' : 'apply', bashCommand: finalCommand, authorization: finalAuthorization, success: status === 'success', isCancelled: status === 'cancelled', status }));
    publish(finalCommand, true, status === 'success' ? 'allow' : 'apply', finalAuthorization);
    return resultPayload(command, result, status);
  },
});
