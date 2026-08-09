import React, { useEffect, useState } from "react";
import { Brain, Bug, Play, RotateCcw, Trash2 } from "lucide-react";
import { Notice } from "obsidian";
import { useSettings } from "@/hooks/use-settings";
import { MEMORY_IDLE_HOUR_OPTIONS, MemorySettings } from "@/types";
import { MemoryStats } from "@/logic/memory-types";
import MemoryLogic from "@/logic/memory-logic";
import MemoryJobQueue from "@/logic/memory-job-queue";
import { SessionLogic, SessionMetadata } from "@/logic/session-logic";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { Button } from "@/ui/elements/button";
import { ModelVariantSelect } from "../model-variant-select";
import { SettingDropdownTrigger } from "../setting-dropdown-trigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/elements/dropdown-menu";

function formatLocalDateTime(value?: string): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatIdleHours(hours: number): string {
  return hours === 0.5 ? "30 min" : `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function formatSessionLabel(session: SessionMetadata): string {
  return `${session.title || "Untitled session"} · ${new Date(session.updatedAt).toLocaleString()}`;
}

export const MemorySetting: React.FC = () => {
  const { models, defaultAgentModel, memorySettings, updateMemorySettings } = useSettings();
  const [stats, setStats] = useState<MemoryStats>({ enabled: memorySettings.enabled, entryCount: 0, pendingJobs: 0, retryableJobs: 0 });
  const [retrying, setRetrying] = useState(false);
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [triggeringExtraction, setTriggeringExtraction] = useState(false);

  const refreshStats = async () => setStats(await MemoryLogic.getInstance().getStats());
  useEffect(() => { void refreshStats(); }, [memorySettings.enabled]);
  useEffect(() => {
    if (!__DEV__ || !memorySettings.enabled) {
      setSessions([]);
      setSelectedSessionId(null);
      return;
    }
    void SessionLogic.getInstance().listSessions().then((savedSessions) => {
      setSessions(savedSessions);
      setSelectedSessionId((current) => savedSessions.some((session) => session.id === current)
        ? current
        : savedSessions[0]?.id ?? null);
    });
  }, [memorySettings.enabled]);

  const update = async (patch: Partial<MemorySettings>) => {
    await updateMemorySettings({ ...memorySettings, ...patch });
    await refreshStats();
  };

  const toggleFeature = async (enabled: boolean) => {
    if (enabled) {
      new Notice("Memory may send saved conversation content to the selected model provider. Memory files stay in this Vault's private plugin data.", 7000);
    }
    await update({ enabled });
  };

  const clear = async () => {
    if (!window.confirm("Clear all long-term memories and background memory state? Conversation sessions will be kept.")) return;
    await MemoryJobQueue.getInstance().clear();
    await MemoryLogic.getInstance().clearAll();
    await refreshStats();
    new Notice("All long-term memories cleared; conversation sessions kept");
  };

  const retryFailedJobs = async () => {
    setRetrying(true);
    try {
      const count = await MemoryJobQueue.getInstance().retryFailedJobs();
      await refreshStats();
      new Notice(count > 0
        ? `${count} failed memory ${count === 1 ? "job" : "jobs"} queued for retry. The daily model call limit still applies.`
        : "No failed memory jobs to retry");
    } catch (error) {
      console.error("[Memory] Failed to retry background jobs", error);
      new Notice("Failed to retry memory jobs");
    } finally {
      setRetrying(false);
    }
  };

  const triggerSessionExtraction = async () => {
    if (!selectedSessionId) return;
    setTriggeringExtraction(true);
    try {
      await MemoryJobQueue.getInstance().triggerSessionExtraction(selectedSessionId);
      await refreshStats();
      new Notice("Session queued for immediate memory extraction. The daily model call limit and safety filters still apply.", 7000);
    } catch (error) {
      console.error("[Memory] Failed to trigger session extraction", error);
      new Notice(error instanceof Error ? error.message : "Failed to trigger session extraction");
    } finally {
      setTriggeringExtraction(false);
    }
  };

  const selectedSession = sessions.find((session) => session.id === selectedSessionId);

  return (
    <div className="tw-min-w-0 tw-max-w-full tw-space-y-6">
      <div className="tw-rounded-lg tw-border tw-border-solid tw-border-border tw-p-4 tw-space-y-3">
        <div className="tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-2">
            <Brain className="tw-size-5" />
            <div>
              <div className="tw-font-bold">Memory</div>
              <div className="tw-text-xs tw-text-muted-foreground">Private generated state for this Vault. Disabled by default.</div>
            </div>
          </div>
          <SettingSwitch checked={memorySettings.enabled} onCheckedChange={toggleFeature} />
        </div>
        <p className="tw-text-xs tw-text-muted-foreground">
          Automatic generation sends eligible saved session content to the selected provider after the idle delay. Generated memory is lower-priority historical data and never replaces current instructions or live evidence. Sync behavior depends on your .obsidian sync settings.
        </p>
      </div>

      {memorySettings.enabled && (
        <>
          <section className="tw-space-y-4">
            <div className="tw-font-bold">Behavior</div>
            <div className="tw-flex tw-min-w-0 tw-items-center tw-justify-between tw-gap-4">
              <span className="tw-min-w-0"><span className="tw-text-sm">Idle threshold</span><span className="tw-block tw-text-xs tw-text-muted-foreground">Wait after the last saved activity before extraction.</span></span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SettingDropdownTrigger>{formatIdleHours(memorySettings.idleHours)}</SettingDropdownTrigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="tw-max-w-[calc(100vw-2rem)]">
                  {MEMORY_IDLE_HOUR_OPTIONS.map((hours) => (
                    <DropdownMenuItem key={hours} onSelect={() => void update({ idleHours: hours })}>
                      {formatIdleHours(hours)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </section>

          <section className="tw-space-y-3">
            <div className="tw-font-bold">Background models and limits</div>
            <ModelVariantSelect
              label="Extraction model"
              models={models}
              selectedModelId={memorySettings.extractModelId || null}
              variant={memorySettings.extractModelVariant}
              fallbackModel={defaultAgentModel ?? models[0] ?? null}
              fallbackLabel="Default agent model"
              onChange={(modelId, extractModelVariant) => update({ extractModelId: modelId ?? "", extractModelVariant })}
            />
            <ModelVariantSelect
              label="Consolidation model"
              models={models}
              selectedModelId={memorySettings.consolidationModelId || null}
              variant={memorySettings.consolidationModelVariant}
              fallbackModel={defaultAgentModel ?? models[0] ?? null}
              fallbackLabel="Default agent model"
              onChange={(modelId, consolidationModelVariant) => update({ consolidationModelId: modelId ?? "", consolidationModelVariant })}
            />
            <label className="tw-flex tw-items-center tw-justify-between tw-gap-4">
              <span><span className="tw-text-sm">Max background model calls per day</span><span className="tw-block tw-text-xs tw-text-muted-foreground">Extraction and consolidation calls combined. Resets daily; 0 pauses automatic processing.</span></span>
              <input className="tw-w-24 tw-rounded-md tw-border tw-border-solid tw-border-border tw-bg-primary tw-px-3 tw-py-2" type="number" min={0} value={memorySettings.dailyCallLimit} onChange={(event) => update({ dailyCallLimit: Number(event.target.value) })} />
            </label>
          </section>

          <section className="tw-space-y-3">
            <div className="tw-font-bold">Status and recovery</div>
            <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-text-sm">
              <div>Memory entries: {stats.entryCount}</div>
              <div>Pending jobs: {stats.pendingJobs}</div>
              {stats.retryableJobs > 0 && <div className="tw-col-span-2">Retryable jobs: {stats.retryableJobs}</div>}
              <div className="tw-col-span-2">Last consolidation: {formatLocalDateTime(stats.lastConsolidatedAt)}</div>
              {stats.lastError && <div className="tw-col-span-2 tw-text-error">Last error: {stats.lastError}</div>}
            </div>
            <div className="tw-flex tw-flex-wrap tw-gap-2">
              {stats.retryableJobs > 0 && (
                <Button variant="secondary" onClick={retryFailedJobs} disabled={retrying}>
                  <RotateCcw className="tw-size-4" />{retrying ? "Retrying..." : "Retry failed jobs"}
                </Button>
              )}
              <Button variant="destructive" onClick={clear}><Trash2 className="tw-size-4" />Clear all memory</Button>
            </div>
            <p className="tw-text-xs tw-text-muted-foreground">Clearing memory does not delete conversation sessions.</p>
          </section>

          {__DEV__ && (
            <section className="tw-space-y-3 tw-rounded-lg tw-border tw-border-dashed tw-border-border tw-p-4">
              <div className="tw-flex tw-items-center tw-gap-2 tw-font-bold"><Bug className="tw-size-4" />Debug extraction</div>
              <p className="tw-text-xs tw-text-muted-foreground">
                Development build only. Force any saved session back through Extraction immediately, even if its current revision was already processed. This also discards that session's pending raw extraction. Explicitly forgotten revisions remain excluded.
              </p>
              <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SettingDropdownTrigger className="tw-min-w-0 tw-max-w-full tw-flex-1">
                      <span className="tw-truncate">{selectedSession ? formatSessionLabel(selectedSession) : "No saved sessions"}</span>
                    </SettingDropdownTrigger>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="tw-max-h-80 tw-max-w-[calc(100vw-2rem)] tw-overflow-y-auto">
                    {sessions.map((session) => (
                      <DropdownMenuItem key={session.id} onSelect={() => setSelectedSessionId(session.id)}>
                        <span className="tw-max-w-xl tw-truncate">{formatSessionLabel(session)}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="secondary" onClick={triggerSessionExtraction} disabled={!selectedSessionId || triggeringExtraction}>
                  <Play className="tw-size-4" />{triggeringExtraction ? "Queueing..." : "Extract now"}
                </Button>
              </div>
              <p className="tw-text-xs tw-text-muted-foreground">Debug extraction bypasses the minimum message/text thresholds. Sensitive-data filtering, model configuration, and the daily call limit still apply.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
};
