import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/elements/select';
import { useSettings } from '@/hooks/use-settings';
import type { BashSandboxMode } from '@/types';
import { t } from '@/i18n';

export const BashPermissionSettings: React.FC = () => {
  const { bashSandbox, updateBashSandbox } = useSettings();

  return (
    <div className="tw-space-y-3">
      <div className="tw-flex tw-flex-col tw-gap-2 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between">
        <span className="tw-text-sm tw-font-medium">{t('settings:bashSandboxMode')}</span>
        <Select value={bashSandbox.mode} onValueChange={(mode) => void updateBashSandbox({ mode: mode as BashSandboxMode })}>
          <SelectTrigger className="tw-w-full sm:tw-w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="read-only">{t('settings:bashSandboxReadOnly')}</SelectItem>
            <SelectItem value="workspace-write">{t('settings:bashSandboxWorkspaceWrite')}</SelectItem>
            <SelectItem value="full-access">{t('settings:bashSandboxFullAccess')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="tw-rounded tw-border tw-border-border tw-bg-muted/30 tw-p-3 tw-text-sm tw-text-muted-foreground">
        {t('settings:bashSandboxReadNetworkNotice')}
      </div>
      {bashSandbox.mode === 'workspace-write' && (
        <div className="tw-flex tw-gap-2 tw-rounded tw-border tw-border-orange-500/50 tw-bg-orange-500/10 tw-p-3 tw-text-sm">
          <AlertTriangle className="tw-mt-0.5 tw-size-4 tw-shrink-0 tw-text-orange-500" />
          <span>{t('settings:bashSandboxWorkspaceWriteWarning')}</span>
        </div>
      )}
      {bashSandbox.mode === 'full-access' && (
        <div className="tw-flex tw-gap-2 tw-rounded tw-border tw-border-orange-500/50 tw-bg-orange-500/10 tw-p-3 tw-text-sm">
          <AlertTriangle className="tw-mt-0.5 tw-size-4 tw-shrink-0 tw-text-orange-500" />
          <span>{t('settings:bashSandboxFullAccessWarning')}</span>
        </div>
      )}
    </div>
  );
};
