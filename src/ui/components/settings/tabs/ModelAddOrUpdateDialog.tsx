import React, { useCallback, useEffect, useState } from "react";
import { useTab } from "@/hooks/TabContext";
import { ModelConfig, ModelProviders } from "@/types";
import { Button } from "@/ui/elements/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/elements/dialog";
import { debounce } from "@/ui/components/utils";
import { useSettingsLogic } from "@/hooks/use-settings";
import { CommonModelConfig, NEW_SECRET_VALUE } from "./ProviderModelConfig/CommonModelConfig";
import { ProviderModelConfig } from "./ProviderModelConfig/ProviderModelConfig";
import { Notice } from "obsidian";
import { t } from "@/i18n";


interface ModelAddOrUpdateDialogProps {
  initialModel: ModelConfig;
  isUpdate: boolean;
  open: boolean;
  close: () => void;
}

export const ModelAddOrUpdateDialog: React.FC<ModelAddOrUpdateDialogProps> = ({
  initialModel,
  isUpdate,
  open,
  close,
}) => {
  const { modalContainer } = useTab();
  const [dialogElement, setDialogElement] = useState<HTMLDivElement | null>(null);

  const [model, setModel] = useState<ModelConfig>(initialModel);
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newSecretId, setNewSecretId] = useState('');
  const [secretChoice, setSecretChoice] = useState('__none__');
  const { addOrUpdateModel, createCustomSecret, listSecretIds } = useSettingsLogic();
  const [secretIds, setSecretIds] = useState<string[]>([]);


  useEffect(() => {
    setModel(initialModel);
    setSecretChoice(initialModel.credentialRef ?? '__none__');
    setNewSecretId('');
    setNewSecretValue('');
    setSecretIds(listSecretIds());
  }, [initialModel]);

  // Clean up model data by trimming whitespace
  const getCleanedModel = (modelData: ModelConfig): ModelConfig => {
    return {
      ...modelData,
      id: modelData.id?.trim(),
      name: modelData.name?.trim(),
      baseUrl: modelData.baseUrl?.trim(),
      credentialRef: modelData.credentialRef?.trim() || undefined,
      apiKey: modelData.credentialRef ? undefined : modelData.apiKey,
    };
  };

  const onSave = async () => {
    let cleanedModel = getCleanedModel(model);
    if (!cleanedModel.id || !cleanedModel.name) {
      new Notice(t("settings:modelRequired"));
      return;
    }
    if (cleanedModel.contextWindow !== undefined
      && cleanedModel.maxTokens !== undefined
      && cleanedModel.contextWindow <= cleanedModel.maxTokens) {
      new Notice(t("settings:contextWindowError"));
      return;
    }
    try {
      if (cleanedModel.connectionMode === 'custom' && !cleanedModel.apiKey && secretChoice === '__none__') {
        new Notice(t('settings:secretIdRequired'));
        return;
      }
      if (secretChoice === NEW_SECRET_VALUE) {
        const secretId = newSecretId.trim();
        if (!secretId) {
          new Notice(t('settings:secretIdRequired'));
          return;
        }
        if (!newSecretValue) {
          new Notice(t('settings:secretCannotBeEmpty'));
          return;
        }
        createCustomSecret(secretId, newSecretValue);
        cleanedModel = { ...cleanedModel, credentialRef: secretId, apiKey: undefined };
      }
      if (isUpdate) {
        // 更新模式：传递原始ID
        await addOrUpdateModel(cleanedModel, initialModel.id);
      } else {
        // 添加模式：不传递原始ID
        await addOrUpdateModel(cleanedModel);
      }
      close();
    } catch (error) {
      console.error('Failed to save model:', error);
      // 可以在这里添加错误提示
    }
  };

  const debouncedSetModel = useCallback(debounce(setModel, 500), [setModel]);


  return (
    <Dialog open={open} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="tw-max-h-[calc(100vh-2rem)] tw-grid-rows-[auto_minmax(0,1fr)_auto] tw-overflow-hidden sm:tw-max-w-[425px]"
        container={modalContainer}
        ref={(el: HTMLDivElement | null) => setDialogElement(el)}
      >
        <DialogHeader>
          <DialogTitle>{isUpdate ? t("settings:updateModel") : t("settings:addModel")}</DialogTitle>
          <DialogDescription>{isUpdate ? t("settings:updateModelDescription") : t("settings:addModelDescription")}</DialogDescription>
        </DialogHeader>
        <div className="tw-min-h-0 tw-overflow-y-auto tw-pr-2">
          <CommonModelConfig model={model} setModel={setModel} dialogElement={dialogElement}
            secretIds={secretIds} secretChoice={secretChoice} setSecretChoice={setSecretChoice}
            newSecretId={newSecretId} setNewSecretId={setNewSecretId}
            newSecretValue={newSecretValue} setNewSecretValue={setNewSecretValue} />
          <ProviderModelConfig model={model} debouncedSetModel={debouncedSetModel} setModel={setModel}></ProviderModelConfig>
        </div>

        <div className="tw-flex tw-items-center tw-justify-end tw-gap-4">
          <div className="tw-flex tw-gap-2">
            <Button variant="secondary" onClick={onSave}>
              {t("settings:saveModel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
