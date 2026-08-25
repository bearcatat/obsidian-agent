import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/elements/collapsible';
import { Button } from '@/ui/elements/button';
import React from 'react';
import { BashAuthorizationSummary, BashCommand } from '@/types';
import { ChevronsUpDown, Check, X, Terminal, AlertTriangle } from 'lucide-react';
import { t } from '../../../../../i18n';

type Decision = 'apply' | 'reject' | 'allow' | 'deny' | null;

interface Props {
  origin_answered_state: boolean;
  bashCommand: BashCommand;
  decision: Decision;
  authorization?: BashAuthorizationSummary;
  pendingLabel?: string;
  onApply?: () => void;
  onReject?: () => void;
}

const modeLabel = (mode: BashAuthorizationSummary['configuredMode']) => mode === 'read-only'
  ? t('settings:bashSandboxReadOnly')
  : mode === 'workspace-write' ? t('settings:bashSandboxWorkspaceWrite') : t('settings:bashSandboxFullAccess');

const elevationTriggerLabel = (trigger: NonNullable<BashAuthorizationSummary['elevation']>['trigger']) => ({
  'requested-capability': t('agent:elevationRequestedCapability'),
  'sandbox-denied': t('agent:elevationSandboxDenied'),
  'powershell-https-compatibility': t('agent:elevationPowerShellHttps'),
} as const)[trigger];

export const BashToolMessageCard: React.FC<Props> = ({ origin_answered_state, bashCommand, decision, authorization, pendingLabel, onApply, onReject }) => {
  const [isOpen, setIsOpen] = React.useState(!origin_answered_state);
  const [isAnswered, setIsAnswered] = React.useState(origin_answered_state);
  const answered = origin_answered_state || isAnswered;

  React.useEffect(() => {
    setIsAnswered(origin_answered_state);
    if (origin_answered_state) setIsOpen(false);
  }, [origin_answered_state]);

  const statusText = () => {
    // A user may have clicked the previous human-approval controls, leaving
    // local state answered while the same card has already moved on to a new
    // execution stage. The explicit pending label always wins until terminal.
    if (!origin_answered_state && pendingLabel) return pendingLabel;
    if (!answered) return pendingLabel || t('agent:pendingConfirmation');
    switch (authorization?.outcome ?? bashCommand.outcome) {
      case 'success': return t('agent:executedSuccessfully');
      case 'command-failed': return t('agent:executionFailed');
      case 'sandbox-unavailable': return t('agent:sandboxUnavailable');
      case 'sandbox-denied': return t('agent:sandboxDenied');
      case 'approval-required': return t('agent:approvalRequired');
      case 'safety-denied': return t('agent:blockedByHardGuard');
      case 'cancelled': return t('agent:rejected');
      default: return decision === 'reject' || decision === 'deny' ? t('agent:denied') : t('agent:processed');
    }
  };

  const sourceLabel = authorization ? ({
    'hard-guard': t('agent:hardGuard'),
    automatic: t('agent:approvalSourceAutomatic'),
    model: t('agent:approvalSourceModel'),
    human: t('agent:approvalSourceHuman'),
    reuse: t('agent:approvalSourceReuse'),
  } as const)[authorization.source] : null;

  const approve = () => { setIsOpen(false); setIsAnswered(true); onApply?.(); };
  const reject = () => { setIsOpen(false); setIsAnswered(true); onReject?.(); };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="tw-w-full tw-rounded-md tw-border tw-border-solid tw-border-border tw-py-1">
      <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-0">
        <div className="tw-flex tw-min-w-0 tw-items-center tw-gap-2">
          <Terminal className="tw-size-4 tw-shrink-0 tw-text-muted-foreground" />
          <span>{statusText()}:</span>
          <span className="tw-truncate tw-font-mono tw-text-sm">{bashCommand.workingDirectory || '/'}</span>
          {(authorization?.outcome === 'safety-denied' || authorization?.effectiveMode === 'full-access') && <AlertTriangle className="tw-size-4 tw-shrink-0 tw-text-orange-500" />}
        </div>
        {answered && <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="size-8"><ChevronsUpDown className="tw-size-4" /></Button></CollapsibleTrigger>}
      </div>
      <CollapsibleContent className="tw-flex tw-w-full tw-flex-col tw-px-1">
        <div className="tw-mt-2 tw-w-full tw-overflow-hidden tw-rounded tw-border tw-border-border"><div className="tw-font-mono tw-text-sm tw-leading-relaxed"><div className="tw-flex tw-items-start"><span className="tw-select-none tw-px-2 tw-py-1 tw-text-green-400">$</span><span className="tw-flex-1 tw-whitespace-pre-wrap tw-py-1 tw-pr-2 tw-text-gray-100">{bashCommand.command}</span></div></div></div>
        {authorization && <div className="tw-mt-2 tw-rounded tw-bg-muted/40 tw-px-2 tw-py-1.5 tw-text-xs tw-text-muted-foreground">
          <div>{sourceLabel} · {modeLabel(authorization.effectiveMode)}</div>
          {authorization.requestedMode && <div className="tw-mt-1">{t('agent:requestedWriteMode', { mode: modeLabel(authorization.requestedMode) })}</div>}
          {authorization.elevation && <div className="tw-mt-1">{t('agent:elevationTrace', { trigger: elevationTriggerLabel(authorization.elevation.trigger) })}</div>}
          {bashCommand.attempts && bashCommand.attempts.length > 0 && <div className="tw-mt-1">{t('agent:executionAttempts', { attempts: bashCommand.attempts.map((attempt) => `${attempt.index}:${modeLabel(attempt.mode)}/${attempt.status}`).join(' → ') })}</div>}
          {authorization.reason && <div className="tw-mt-1 tw-break-words">{authorization.reason}</div>}
        </div>}
        {bashCommand.shell && <div className="tw-mt-2 tw-text-xs tw-text-muted-foreground">
          {bashCommand.shell.version
            ? t('agent:commandShellVersion', { name: bashCommand.shell.name, version: bashCommand.shell.version })
            : t('agent:commandShell', { name: bashCommand.shell.name })}
        </div>}
        {bashCommand.output && <div className="tw-mt-2 tw-w-full tw-overflow-hidden tw-rounded tw-border tw-border-border"><pre className="tw-max-h-48 tw-overflow-y-auto tw-whitespace-pre-wrap tw-break-all tw-p-2 tw-text-xs tw-text-gray-300">{bashCommand.output}</pre></div>}
        {bashCommand.error && bashCommand.error !== 'User rejected the command' && <div className="tw-mt-2 tw-w-full tw-overflow-hidden tw-rounded tw-border tw-border-border tw-bg-red-900/10"><pre className="tw-max-h-32 tw-overflow-y-auto tw-whitespace-pre-wrap tw-p-2 tw-text-xs tw-text-red-400">{bashCommand.error}</pre></div>}
        {bashCommand.exitCode !== undefined && <div className={bashCommand.exitCode === 0 ? 'tw-mt-2 tw-text-sm tw-text-green-500' : 'tw-mt-2 tw-text-sm tw-text-red-500'}>{t('agent:exitCode')}: {bashCommand.exitCode}</div>}
        {!answered && onApply && onReject && <div className="tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-px-2"><Button variant="ghost" size="fit" className="tw-text-green-600 dark:tw-text-green-400" onClick={approve}><Check className="tw-mr-1 tw-size-4" />{t('agent:execute')}</Button><Button variant="ghost" size="fit" className="tw-text-red-600 dark:tw-text-red-400" onClick={reject}><X className="tw-mr-1 tw-size-4" />{t('agent:denyAction')}</Button></div>}
      </CollapsibleContent>
    </Collapsible>
  );
};
