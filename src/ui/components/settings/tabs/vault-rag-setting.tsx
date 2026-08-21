import { useEffect, useState } from "react";
import { Notice } from "obsidian";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { EmbeddingModelConfig } from "@/types";
import { useSettingsLogic, useSettingsState } from "@/hooks/use-settings";
import VaultRagService from "@/retrieval/VaultRagService";
import { getGlobalApp } from "@/utils";
import { Button } from "@/ui/elements/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/elements/dialog";
import { FormField } from "@/ui/elements/form-field";
import { Input } from "@/ui/elements/input";
import { PasswordInput } from "@/ui/elements/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { t } from "@/i18n";

const blankModel: EmbeddingModelConfig = { id: "", name: "", provider: "openai-compatible", baseUrl: "", apiKey: "" };

export function EmbeddingModelsSetting(): React.ReactElement {
  return <VaultRagSetting section="models" />;
}

export function VaultRagIndexSetting(): React.ReactElement {
  return <VaultRagSetting section="index" />;
}

function VaultRagSetting({ section }: { section: "models" | "index" }): React.ReactElement {
  const { embeddingModels, ragSettings } = useSettingsState();
  const { addOrUpdateEmbeddingModel, removeEmbeddingModel, setRagEmbeddingModelId } = useSettingsLogic();
  const [editing, setEditing] = useState<EmbeddingModelConfig | null>(null);
  const [originalId, setOriginalId] = useState<string | undefined>();
  const [status, setStatus] = useState(VaultRagService.getInstance().getStatus());
  const [pendingUpdates, setPendingUpdates] = useState<number | null>(null);

  useEffect(() => VaultRagService.getInstance().subscribe(() => setStatus(VaultRagService.getInstance().getStatus())), []);
  const selected = ragSettings.embeddingModelId;
  const busy = ["building", "refreshing", "rebuilding"].includes(status.operation);

  useEffect(() => {
    if (!selected || status.operation !== "available") {
      setPendingUpdates(null);
      return;
    }
    let disposed = false;
    const refreshPendingUpdates = (file?: { path: string; extension?: string }) => {
      if (file && (file.extension !== "md" || file.path.startsWith(".obsidian-agent/"))) return;
      void VaultRagService.getInstance().getPendingUpdateCount()
        .then((count) => { if (!disposed) setPendingUpdates(count); })
        .catch(() => { if (!disposed) setPendingUpdates(null); });
    };
    refreshPendingUpdates();
    const vault = getGlobalApp().vault;
    const eventRefs = [
      vault.on("create", refreshPendingUpdates),
      vault.on("modify", refreshPendingUpdates),
      vault.on("delete", refreshPendingUpdates),
      vault.on("rename", refreshPendingUpdates),
    ];
    return () => {
      disposed = true;
      eventRefs.forEach((eventRef) => vault.offref(eventRef));
    };
  }, [selected, status.operation]);

  const removeModel = async (modelId: string) => {
    try {
      await removeEmbeddingModel(modelId);
    } catch {
      new Notice(t("settings:embeddingModelRemoveFailed"));
    }
  };

  return <div className="tw-space-y-6">
    {section === "models" && <section>
      <div className="tw-mb-3 tw-text-xl tw-font-bold">{t("settings:embeddingModels")}</div>
      <Table><TableHeader><TableRow>
        <TableHead>{t("common:id")}</TableHead><TableHead>{t("common:name")}</TableHead><TableHead>{t("settings:provider")}</TableHead><TableHead>{t("common:actions")}</TableHead>
      </TableRow></TableHeader><TableBody>
        {embeddingModels.map((model) => <TableRow key={model.id}>
          <TableCell>{model.id}</TableCell><TableCell>{model.name}</TableCell><TableCell>OpenAI-compatible API</TableCell>
          <TableCell><div className="tw-flex tw-gap-1">
            <Button variant="ghost" size="icon" aria-label={t("common:edit")} onClick={() => { setEditing(model); setOriginalId(model.id); }}><Pencil className="tw-size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={t("common:delete")} onClick={() => void removeModel(model.id)}><Trash2 className="tw-size-4" /></Button>
          </div></TableCell>
        </TableRow>)}
      </TableBody></Table>
      <div className="tw-mt-4 tw-flex tw-justify-end"><Button variant="secondary" onClick={() => { setEditing(blankModel); setOriginalId(undefined); }}><Plus className="tw-size-4" />{t("settings:addEmbeddingModel")}</Button></div>
      {editing && <EmbeddingModelDialog model={editing} originalId={originalId} close={() => setEditing(null)} save={async (model) => { await addOrUpdateEmbeddingModel(model, originalId); setEditing(null); }} />}
    </section>}
    {section === "index" && <section>
      <div className="tw-mb-3 tw-text-xl tw-font-bold">{t("settings:vaultRag")}</div>
      <div className="tw-space-y-4">
        <div className="tw-flex tw-items-center tw-justify-between tw-gap-4">
          <div className="tw-text-sm tw-font-medium">{t("settings:ragEmbeddingModel")}</div>
          <Select value={selected ?? "none"} onValueChange={(value) => void setRagEmbeddingModelId(value === "none" ? null : value)} disabled={busy}>
            <SelectTrigger className="tw-max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">{t("settings:ragDisabled")}</SelectItem>{embeddingModels.map((model) => <SelectItem key={model.id} value={model.id}>{model.id}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {selected && <div className="tw-space-y-2">
          <div className="tw-text-sm">{t("common:status")}: {status.operation} · {status.completed}/{status.total} {t("settings:ragFiles")}{status.operation === "available" && pendingUpdates !== null ? ` · ${t("settings:ragPendingFiles", { count: pendingUpdates })}` : ""}</div>
          {status.message && <div className="tw-mb-2 tw-text-xs tw-text-muted-foreground">{status.message}</div>}
          <div className="tw-flex tw-flex-wrap tw-gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void VaultRagService.getInstance().build()}>{t("settings:ragFullBuild")}</Button>
            <Button variant="secondary" disabled={busy || status.operation !== "available" || !pendingUpdates} onClick={() => void VaultRagService.getInstance().refresh()}>{t("settings:ragIncrementalRefresh")}</Button>
            {busy && <Button variant="destructive" onClick={() => VaultRagService.getInstance().cancel()}>{t("common:cancel")}</Button>}
          </div>
        </div>}
      </div>
    </section>}
  </div>;
}

function EmbeddingModelDialog({ model: initialModel, originalId, close, save }: { model: EmbeddingModelConfig; originalId?: string; close: () => void; save: (model: EmbeddingModelConfig) => Promise<void> }): React.ReactElement {
  const [model, setModel] = useState(initialModel);
  const isUpdate = Boolean(originalId);
  const update = (key: keyof EmbeddingModelConfig, value: string) => setModel((current) => ({ ...current, [key]: value }));
  const onSave = async () => {
    if (!model.id.trim() || !model.name.trim() || !model.baseUrl.trim() || !model.apiKey.trim()) { new Notice(t("settings:embeddingModelRequired")); return; }
    try { await save({ ...model, id: model.id.trim(), name: model.name.trim(), baseUrl: model.baseUrl.trim(), apiKey: model.apiKey.trim() }); } catch { new Notice(t("settings:embeddingModelSaveFailed")); }
  };
  return <Dialog open onOpenChange={(open) => !open && close()}><DialogContent className="sm:tw-max-w-[425px]"><DialogHeader><DialogTitle>{isUpdate ? t("settings:updateEmbeddingModel") : t("settings:addEmbeddingModel")}</DialogTitle><DialogDescription>{t("settings:embeddingModelDescription")}</DialogDescription></DialogHeader>
    <div className="tw-space-y-3"><FormField label={t("common:id")}><Input value={model.id} onChange={(event) => update("id", event.target.value)} /></FormField>
      <FormField label={t("common:name")}><Input value={model.name} onChange={(event) => update("name", event.target.value)} /></FormField>
      <FormField label={t("settings:provider")}><Input value="OpenAI-compatible API" disabled /></FormField>
      <FormField label={t("settings:baseUrl")}><Input value={model.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} /></FormField>
      <FormField label={t("settings:apiKey")}><PasswordInput value={model.apiKey} onChange={(value) => update("apiKey", value)} /></FormField>
    </div><div className="tw-flex tw-justify-end"><Button variant="secondary" onClick={() => void onSave()}>{t("common:save")}</Button></div>
  </DialogContent></Dialog>;
}
