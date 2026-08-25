import { randomUUID } from 'crypto';
import type { BashApprovalScope } from '@/types';

/**
 * A scope is created by one AIAgent.query and never survives its finally block.
 * This prevents exact-decision reuse from leaking into a retry, another query,
 * another conversation, or a later app lifetime.
 */
export function createBashApprovalScope(): BashApprovalScope {
  return {
    id: randomUUID(),
    decisions: new Map(),
    reviewFlights: new Map(),
    closed: false,
  };
}

export function closeBashApprovalScope(scope: BashApprovalScope): void {
  scope.closed = true;
  scope.decisions.clear();
  scope.reviewFlights.clear();
}
