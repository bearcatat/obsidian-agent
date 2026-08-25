import type { BashApprovalReview } from '@/types';

export type BashApprovalAction = 'execute' | 'ask' | 'deny';

export function resolveModelApprovalAction(review: BashApprovalReview): BashApprovalAction {
  if (review.decision === 'deny' || review.authorization === 'conflicts') return 'deny';
  if (review.decision === 'allow'
    && (review.risk === 'low' || review.risk === 'medium')
    && review.authorization === 'explicit') return 'execute';
  return 'ask';
}
