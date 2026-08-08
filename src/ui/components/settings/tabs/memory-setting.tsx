import React, { useEffect, useState } from "react";
import { Brain, ChevronDown, Trash2 } from "lucide-react";
import { Notice } from "obsidian";
import { useSettings } from "@/hooks/use-settings";
import { getAvailableVariants, getDefaultVariant, MEMORY_IDLE_HOUR_OPTIONS, MemorySettings, ModelConfig, ModelVariant } from "@/types";
import { MemoryStats } from "@/logic/memory-types";
import MemoryLogic from "@/logic/memory-logic";
import MemoryJobQueue from "@/logic/memory-job-queue";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { Button } from "@/ui/elements/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/ui/elements/dropdown-menu";

function formatLocalDateTime(value?: string): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export const MemorySetting: React.FC = () => {
  const { models, defaultAgentModel, memorySettings, updateMemorySettings } = useSettings();
  const [stats, setStats] = useState<MemoryStats>({ enabled: memorySettings.enabled, entryCount: 0, pendingJobs: 0 });

  const refreshStats = async () => setStats(await MemoryLogic.getInstance().getStats());
  useEffect(() => { void refreshStats(); }, [memorySettings.enabled]);

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

  const resolveModel = (modelId: string): ModelConfig | null =>
    models.find((model) => model.id === modelId) ?? defaultAgentModel ?? models[0] ?? null;

  const modelSelect = (
    label: string,
    modelId: string,
    variant: ModelVariant | null,
    onChange: (modelId: string, variant: ModelVariant | null) => void,
  ) => {
    const fallbackModel = defaultAgentModel ?? models[0] ?? null;
    const selectedModel = resolveModel(modelId);
    const variants = selectedModel ? getAvailableVariants(selectedModel) : null;
    const selectedVariant = variant ?? (selectedModel ? getDefaultVariant(selectedModel) : null);
    const selectedVariantLabel = variants?.find((option) => option.value === selectedVariant)?.label;
    const selectedLabel = selectedModel
      ? `${modelId ? selectedModel.id : `Default | ${selectedModel.id}`}${selectedVariantLabel ? ` | ${selectedVariantLabel}` : ""}`
      : "No model configured";

    const modelMenuItem = (optionModelId: string, model: ModelConfig, label = model.id) => {
      const modelVariants = getAvailableVariants(model);
      if (!modelVariants) {
        return (
          <DropdownMenuItem key={optionModelId || "default"} onSelect={() => onChange(optionModelId, null)}>
            {label}
          </DropdownMenuItem>
        );
      }

      return (
        <DropdownMenuSub key={optionModelId || "default"}>
          <DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {modelVariants.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => onChange(optionModelId, option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    };

    return (
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-4">
        <span className="tw-text-sm">{label}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="tw-w-64 tw-justify-between">
              <span className="tw-truncate">{selectedLabel}</span>
              <ChevronDown className="tw-size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {fallbackModel && modelMenuItem("", fallbackModel, "Default agent model")}
            {models.map((model) => modelMenuItem(model.id, model))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="tw-space-y-6">
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
            <label className="tw-flex tw-items-center tw-justify-between tw-gap-4">
              <span><span className="tw-text-sm">Idle threshold</span><span className="tw-block tw-text-xs tw-text-muted-foreground">Wait after the last saved activity before extraction.</span></span>
              <select
                className="tw-w-32 tw-rounded-md tw-border tw-border-solid tw-border-border tw-bg-primary tw-px-3 tw-py-2"
                value={memorySettings.idleHours}
                onChange={(event) => update({ idleHours: Number(event.target.value) })}
              >
                {MEMORY_IDLE_HOUR_OPTIONS.map((hours) => (
                  <option key={hours} value={hours}>{hours === 0.5 ? "30 min" : `${hours} ${hours === 1 ? "hour" : "hours"}`}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="tw-space-y-3">
            <div className="tw-font-bold">Background models and limits</div>
            {modelSelect("Extraction model", memorySettings.extractModelId, memorySettings.extractModelVariant, (extractModelId, extractModelVariant) => update({ extractModelId, extractModelVariant }))}
            {modelSelect("Consolidation model", memorySettings.consolidationModelId, memorySettings.consolidationModelVariant, (consolidationModelId, consolidationModelVariant) => update({ consolidationModelId, consolidationModelVariant }))}
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
              <div className="tw-col-span-2">Last consolidation: {formatLocalDateTime(stats.lastConsolidatedAt)}</div>
              {stats.lastError && <div className="tw-col-span-2 tw-text-error">Last error: {stats.lastError}</div>}
            </div>
            <div className="tw-flex tw-gap-2">
              <Button variant="destructive" onClick={clear}><Trash2 className="tw-size-4" />Clear all memory</Button>
            </div>
            <p className="tw-text-xs tw-text-muted-foreground">Clearing memory does not delete conversation sessions.</p>
          </section>
        </>
      )}
    </div>
  );
};
