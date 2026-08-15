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
import { formatDateTime, formatNumber, getErrorMessage } from "@/i18n";
import { useTranslation } from "@/i18n/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/elements/dropdown-menu";

export const MemorySetting: React.FC = () => {
  const { models, defaultAgentModel, memorySettings, updateMemorySettings } = useSettings();
  const { t } = useTranslation("settings");
  const [stats, setStats] = useState<MemoryStats>({ enabled: memorySettings.enabled, entryCount: 0, pendingJobs: 0, retryableJobs: 0 });
  const [retrying, setRetrying] = useState(false);
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [triggeringExtraction, setTriggeringExtraction] = useState(false);

  const formatLocalDateTime = (value?: string): string => (
    value ? formatDateTime(value) : t("never")
  );

  const formatIdleHours = (hours: number): string => {
    if (hours === 0.5) {
      return t("memoryMinutes", { formattedCount: formatNumber(30) });
    }
    return t("memoryHours", {
      count: hours,
      formattedCount: formatNumber(hours),
    });
  };

  const formatSessionLabel = (session: SessionMetadata): string => (
    `${session.title || t("untitledSession")} · ${formatDateTime(session.updatedAt)}`
  );

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
      new Notice(t("memoryWarning"), 7000);
    }
    await update({ enabled });
  };

  const clear = async () => {
    if (!window.confirm(t("confirmClearMemory"))) return;
    await MemoryJobQueue.getInstance().clear();
    await MemoryLogic.getInstance().clearAll();
    await refreshStats();
    new Notice(t("memoryCleared"));
  };

  const retryFailedJobs = async () => {
    setRetrying(true);
    try {
      const count = await MemoryJobQueue.getInstance().retryFailedJobs();
      await refreshStats();
      new Notice(count > 0
        ? t("failedMemoryJobs", { count, formattedCount: formatNumber(count) })
        : t("noFailedMemoryJobs"));
    } catch (error) {
      console.error("[Memory] Failed to retry background jobs", error);
      new Notice(t("memoryActionFailed", {
        action: t("retryFailedJobs"),
        cause: getErrorMessage(error),
      }));
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
      new Notice(t("sessionQueued"), 7000);
    } catch (error) {
      console.error("[Memory] Failed to trigger session extraction", error);
      new Notice(t("memoryActionFailed", {
        action: t("extractNow"),
        cause: getErrorMessage(error),
      }));
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
              <div className="tw-font-bold">{t("memory")}</div>
              <div className="tw-text-xs tw-text-muted-foreground">{t("memoryDescription")}</div>
            </div>
          </div>
          <SettingSwitch checked={memorySettings.enabled} onCheckedChange={toggleFeature} />
        </div>
        <p className="tw-text-xs tw-text-muted-foreground">
          {t("memoryAutoDescription")}
        </p>
      </div>

      {memorySettings.enabled && (
        <>
          <section className="tw-space-y-4">
            <div className="tw-font-bold">{t("behavior")}</div>
            <div className="tw-flex tw-min-w-0 tw-items-center tw-justify-between tw-gap-4">
              <span className="tw-min-w-0"><span className="tw-text-sm">{t("idleThreshold")}</span><span className="tw-block tw-text-xs tw-text-muted-foreground">{t("idleThresholdDescription")}</span></span>
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
            <div className="tw-font-bold">{t("backgroundModelsAndLimits")}</div>
            <ModelVariantSelect
              label={t("extractionModel")}
              models={models}
              selectedModelId={memorySettings.extractModelId || null}
              variant={memorySettings.extractModelVariant}
              fallbackModel={defaultAgentModel ?? models[0] ?? null}
              fallbackLabel={t("defaultAgentModelFallback")}
              onChange={(modelId, extractModelVariant) => update({ extractModelId: modelId ?? "", extractModelVariant })}
            />
            <ModelVariantSelect
              label={t("consolidationModel")}
              models={models}
              selectedModelId={memorySettings.consolidationModelId || null}
              variant={memorySettings.consolidationModelVariant}
              fallbackModel={defaultAgentModel ?? models[0] ?? null}
              fallbackLabel={t("defaultAgentModelFallback")}
              onChange={(modelId, consolidationModelVariant) => update({ consolidationModelId: modelId ?? "", consolidationModelVariant })}
            />
            <label className="tw-flex tw-items-center tw-justify-between tw-gap-4">
              <span><span className="tw-text-sm">{t("maxBackgroundCalls")}</span><span className="tw-block tw-text-xs tw-text-muted-foreground">{t("maxBackgroundCallsDescription")}</span></span>
              <input className="tw-w-24 tw-rounded-md tw-border tw-border-solid tw-border-border tw-bg-primary tw-px-3 tw-py-2" type="number" min={0} value={memorySettings.dailyCallLimit} onChange={(event) => update({ dailyCallLimit: Number(event.target.value) })} />
            </label>
          </section>

          <section className="tw-space-y-3">
            <div className="tw-font-bold">{t("statusAndRecovery")}</div>
            <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-text-sm">
              <div>{t("memoryEntries", { formattedCount: formatNumber(stats.entryCount) })}</div>
              <div>{t("pendingJobs", { formattedCount: formatNumber(stats.pendingJobs) })}</div>
              {stats.retryableJobs > 0 && <div className="tw-col-span-2">{t("retryableJobs", { formattedCount: formatNumber(stats.retryableJobs) })}</div>}
              <div className="tw-col-span-2">{t("lastConsolidation", { date: formatLocalDateTime(stats.lastConsolidatedAt) })}</div>
              {stats.lastError && <div className="tw-col-span-2 tw-text-error">{t("lastError", { error: stats.lastError })}</div>}
            </div>
            <div className="tw-flex tw-flex-wrap tw-gap-2">
              {stats.retryableJobs > 0 && (
                <Button variant="secondary" onClick={retryFailedJobs} disabled={retrying}>
                  <RotateCcw className="tw-size-4" />{retrying ? t("retrying") : t("retryFailedJobs")}
                </Button>
              )}
              <Button variant="destructive" onClick={clear}><Trash2 className="tw-size-4" />{t("clearAllMemory")}</Button>
            </div>
            <p className="tw-text-xs tw-text-muted-foreground">{t("clearMemoryDescription")}</p>
          </section>

          {__DEV__ && (
            <section className="tw-space-y-3 tw-rounded-lg tw-border tw-border-dashed tw-border-border tw-p-4">
              <div className="tw-flex tw-items-center tw-gap-2 tw-font-bold"><Bug className="tw-size-4" />{t("debugExtraction")}</div>
              <p className="tw-text-xs tw-text-muted-foreground">
                {t("debugExtractionDescription")}
              </p>
              <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SettingDropdownTrigger className="tw-min-w-0 tw-max-w-full tw-flex-1">
                      <span className="tw-truncate">{selectedSession ? formatSessionLabel(selectedSession) : t("noSavedSessions")}</span>
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
                  <Play className="tw-size-4" />{triggeringExtraction ? t("queueing") : t("extractNow")}
                </Button>
              </div>
              <p className="tw-text-xs tw-text-muted-foreground">{t("debugExtractionDescription")}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
};
