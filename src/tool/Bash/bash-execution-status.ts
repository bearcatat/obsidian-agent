import type { BashOutcomeStatus } from '@/types';
import type { ExecuteResult } from './execute-command';

export type CommandExecutionStatus = Extract<BashOutcomeStatus, 'success' | 'command-failed' | 'cancelled'>;

/**
 * The shell process exit code is the authoritative command outcome. stderr is
 * preserved for display and diagnostics, but successful commands may write
 * warnings there (including through the Windows ACL sandbox).
 */
export function classifyCommandExecution(result: ExecuteResult): CommandExecutionStatus {
  if (result.error === 'Cancelled') return 'cancelled';
  if (result.startupFailed) return 'command-failed';
  return Number.isInteger(result.exitCode) && result.exitCode === 0 ? 'success' : 'command-failed';
}
