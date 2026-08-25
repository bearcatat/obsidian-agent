/// <reference types="node" />
import { createHash } from 'crypto';
import type {
  BashApprovalMode,
  BashApprovalScope,
  BashApprovalReview,
  BashAuthorizationSummary,
  BashElevationTrigger,
  BashOutcomeStatus,
  BashSandboxMode,
} from '@/types';
import type { AgentToolContext } from '@/tool/ToolContext';
import { resolveModelApprovalAction } from './bash-authorization';
import { reviewBashCommand } from './bash-approval-reviewer';

export type ElevationDecision = 'execute' | 'ask' | 'deny';

export interface ElevationResolution {
  decision: ElevationDecision;
  authorization: BashAuthorizationSummary;
}

interface CoordinatorParams {
  command: string;
  vaultPath: string;
  configuredMode: BashSandboxMode;
  approvalMode: BashApprovalMode;
  context: AgentToolContext;
  backend: BashAuthorizationSummary['backend'];
  justification?: string;
  signal?: AbortSignal;
  /** Reports an actual new model-review flight. Reused approvals do not call it. */
  onReviewStart?: () => void;
}

/**
 * Coordinates the only supported write-boundary elevation: one exact command,
 * once, from a restricted mode directly to full access. It owns fingerprints,
 * turn scoping, model-review singleflight, and the trace recorded in tool UI.
 */
export class BashElevationCoordinator {
  constructor(private readonly params: CoordinatorParams) {}

  private get approvalScope(): BashApprovalScope {
    if (this.params.context.bashApprovalScope) return this.params.context.bashApprovalScope;
    throw new Error('Bash approval scope is unavailable');
  }

  get scope(): string {
    return this.approvalScope.id;
  }

  private fingerprint(trigger: BashElevationTrigger): string {
    return createHash('sha256').update(JSON.stringify({
      command: this.params.command,
      vaultPath: this.params.vaultPath,
      configuredMode: this.params.configuredMode,
      targetMode: 'full-access',
      trigger,
      justification: this.params.justification?.trim().replace(/\s+/g, ' ') ?? '',
      shellPlatform: process.platform === 'win32' ? 'powershell' : process.platform === 'darwin' ? 'bash' : process.platform,
    })).digest('hex');
  }

  private authorization(trigger: BashElevationTrigger, source: BashAuthorizationSummary['source'], reason: string): BashAuthorizationSummary {
    const fingerprint = this.fingerprint(trigger);
    return {
      approvalMode: this.params.approvalMode,
      source,
      reason,
      configuredMode: this.params.configuredMode,
      effectiveMode: 'full-access',
      requestedMode: 'full-access',
      backend: this.params.backend,
      elevation: {
        trigger,
        fingerprint,
        scope: this.scope,
        attempt: 1,
        fromMode: this.params.configuredMode as Exclude<BashSandboxMode, 'full-access'>,
        toMode: 'full-access',
      },
    };
  }

  /** Resolves approval only; BashTool keeps ownership of the actual human card. */
  async request(trigger: BashElevationTrigger): Promise<ElevationResolution> {
    if (this.params.configuredMode === 'full-access') {
      throw new Error('An elevation cannot start from full-access');
    }
    if (this.approvalScope.closed) throw new Error('The Bash approval scope is closed');

    const automaticReason = trigger === 'requested-capability'
      ? 'The command requested complete access for one execution'
      : trigger === 'sandbox-denied'
        ? 'The restricted write sandbox denied the command; retrying once with complete access requires approval'
        : 'A restricted PowerShell HTTPS compatibility failure requires one complete-access retry';

    if (this.params.approvalMode === 'full-access') {
      return { decision: 'execute', authorization: this.authorization(trigger, 'automatic', `${automaticReason}; complete-access approval mode allowed it`) };
    }
    if (this.params.approvalMode === 'ask') {
      return { decision: 'ask', authorization: this.authorization(trigger, 'automatic', automaticReason) };
    }

    const authorization = this.authorization(trigger, 'model', 'Evaluating one complete-access elevation with the current model');
    const fingerprint = authorization.elevation!.fingerprint;
    const cached = this.approvalScope.decisions.get(fingerprint);
    if (cached) {
      const cachedDecision = resolveModelApprovalAction(cached);
      return {
        decision: cachedDecision === 'ask' ? 'deny' : cachedDecision,
        authorization: { ...authorization, source: 'reuse', risk: cached.risk, authorization: cached.authorization, reason: cached.reason },
      };
    }

    let reviewFlight = this.approvalScope.reviewFlights.get(fingerprint);
    const joinedInFlightReview = Boolean(reviewFlight);
    if (!reviewFlight) {
      this.params.onReviewStart?.();
      reviewFlight = this.reviewOnce();
      this.approvalScope.reviewFlights.set(fingerprint, reviewFlight);
      void reviewFlight.then(
        () => this.approvalScope.reviewFlights.delete(fingerprint),
        () => this.approvalScope.reviewFlights.delete(fingerprint),
      );
    }

    try {
      const reviewed = await reviewFlight;
      const decision = resolveModelApprovalAction(reviewed);
      const reviewedAuthorization = {
        ...authorization,
        risk: reviewed.risk as BashAuthorizationSummary['risk'],
        authorization: reviewed.authorization as BashAuthorizationSummary['authorization'],
        reason: reviewed.reason.trim().slice(0, 240),
      };
      // Medium risk is eligible for this one automatic approval, but never
      // cached. Exact reuse is deliberately restricted to low-risk allow.
      if (!this.approvalScope.closed && decision === 'execute' && reviewed.risk === 'low') {
        this.approvalScope.decisions.set(fingerprint, reviewed);
      }
      // Two identical calls can reach the reviewer before the first one has
      // completed and populated the low-risk cache. They must share that one
      // review and make the second card truthfully show reuse, rather than
      // looking like a second model approval.
      const reusedInFlightApproval = joinedInFlightReview
        && decision === 'execute'
        && reviewed.risk === 'low'
        && reviewed.authorization === 'explicit';
      return {
        decision,
        authorization: reusedInFlightApproval
          ? { ...reviewedAuthorization, source: 'reuse', reason: `Reused the in-flight exact approval: ${reviewedAuthorization.reason}` }
          : reviewedAuthorization,
      };
    } catch (error) {
      if (this.params.signal?.aborted) throw error;
      return {
        decision: 'ask',
        authorization: { ...authorization, risk: 'unknown', authorization: 'unclear', reason: 'AI review is unavailable; manual confirmation is required' },
      };
    }
  }

  rememberHumanDeny(trigger: BashElevationTrigger, reason: string): void {
    if (this.approvalScope.closed) return;
    this.approvalScope.decisions.set(this.fingerprint(trigger), {
      decision: 'deny', risk: 'low', authorization: 'explicit', reason: reason.slice(0, 240),
    });
  }

  private async reviewOnce(): Promise<BashApprovalReview> {
    const review = await reviewBashCommand(
      this.params.command,
      this.params.context,
      this.params.signal,
      this.params.context.bashApprovalVaultPath ?? this.params.vaultPath,
    );
    return review;
  }
}

/** P4 compatibility retry is intentionally a tiny, non-mutating PowerShell shape. */
export function isNarrowPowerShellHttpsRead(command: string): boolean {
  if (/[;|&<>`\r\n]|\$\(/.test(command)) return false;
  return /^\s*\(\s*(?:Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\s+(?:-UseBasicParsing\s+)?-Uri\s+(['"])https:\/\/[^\s'"]+\1(?:\s+-Method\s+(?:GET|HEAD))?\s*\)\.StatusCode\s*$/i.test(command);
}

export function isWindowsPowerShellHttpsCompatibilityFailure(params: {
  command: string;
  status: BashOutcomeStatus;
  backend: BashAuthorizationSummary['backend'];
  configuredMode: BashSandboxMode;
  error: string;
}): boolean {
  if (params.configuredMode === 'full-access'
    || params.status !== 'command-failed'
    || params.backend !== 'windows-acl'
    || !isNarrowPowerShellHttpsRead(params.command)) return false;
  return /timed?\s*out|connection\s+(?:was\s+)?(?:closed|timed?\s*out)|webexception|schannel|secure\s+channel|unable\s+to\s+connect|proxy|连接超时|连接已关闭/i.test(params.error);
}
