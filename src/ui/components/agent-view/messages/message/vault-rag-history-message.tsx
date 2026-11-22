import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/elements/collapsible';
import { Button } from '@/ui/elements/button';
import { ChevronsUpDown } from 'lucide-react';
import { t } from '@/i18n';

export interface VaultRagHistoryResponse {
  state: 'disabled' | 'not-ready' | 'empty' | 'partial' | 'success' | 'failed';
  hits: Array<{ path: string; startLine: number; endLine: number; score: number; content?: string; failure?: 'unreadable' | 'stale' }>;
  message?: string;
}

/** Read-only renderer for sessions created before Vault RAG was removed. */
export function renderVaultRagHistoryMessage(response: VaultRagHistoryResponse, query?: string): React.ReactNode {
  const successful = response.hits.filter((hit) => hit.content !== undefined);
  return <Collapsible className="tw-w-full tw-rounded-md tw-border tw-border-solid tw-border-border tw-py-1">
    <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-0">
      <div className="tw-min-w-0 tw-truncate tw-text-xs tw-text-muted-foreground">
        Vault RAG: {query ? `“${query}” · ` : ''}{response.state === 'empty' ? t('agent:vaultRagHistoryNoMatches') : t('agent:vaultRagHistoryResults', { count: successful.length })}
      </div>
      <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="tw-size-8" aria-label={t('agent:toggleVaultRagHistory')}><ChevronsUpDown className="tw-size-4" /></Button></CollapsibleTrigger>
    </div>
    <CollapsibleContent className="tw-px-2 tw-pb-2">
      {response.message && <div className="tw-mt-2 tw-text-xs tw-text-muted-foreground">{response.message}</div>}
      {successful.length > 0 && <ul className="tw-mt-2 tw-text-xs">{successful.map((hit) => <li key={`${hit.path}:${hit.startLine}:${hit.endLine}`}>{hit.path} · {hit.score.toFixed(3)}</li>)}</ul>}
    </CollapsibleContent>
  </Collapsible>;
}
