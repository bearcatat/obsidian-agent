import { ModelAddOrUpdateDialog } from "./ModelAddOrUpdateDialog";
import { useState } from "react";
import { ModelTable } from "./model-table";
import { ModelConfig } from "@/types";
import { useSettingsState, useSettingsLogic } from "@/hooks/use-settings";
import { ModelVariantSelect } from "../model-variant-select";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { t } from "../../../../i18n";
import { EmbeddingModelsSetting, VaultRagIndexSetting } from "./vault-rag-setting";

export const ModelSetting: React.FC = () => {
  const _initialModel = {
    id: "",
    name: "",
    provider: "",
    baseUrl: "",
    apiKey: "",
    temperature: 0.1,
    maxTokens: 8192, // 增加默认值以支持 thinking 功能
    topP: 0.3,
    frequencyPenalty: 0.4,
  } as ModelConfig;
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [initialModel, setInitialModel] = useState<ModelConfig>(_initialModel);
  const [isUpdate, setIsUpdate] = useState(false);
  
  const {
    models,
    defaultAgentModel,
    defaultAgentModelVariant,
    titleModel,
    titleModelVariant,
    imageModel,
    imageModelVariant,
    autoContextCompaction,
  } = useSettingsState();
  const { setDefaultAgentModel, setTitleModel, setImageModel, setAutoContextCompaction } = useSettingsLogic();
  
  return (
    <div className="tw-min-w-0 tw-max-w-full tw-space-y-6">
      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">{t('settings:chatModels')}</div>
        <ModelTable
          onEdit={(model) => { 
            setInitialModel(model); 
            setIsUpdate(true); 
            setShowAddDialog(true); 
          }}
          onAdd={() => { 
            setInitialModel(_initialModel); 
            setIsUpdate(false); 
            setShowAddDialog(true); 
          }}
        />
        <ModelAddOrUpdateDialog
          initialModel={initialModel}
          isUpdate={isUpdate}
          open={showAddDialog}
          close={() => setShowAddDialog(false)}
        />
      </section>

      <EmbeddingModelsSetting />

      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">{t('settings:modelSettings')}</div>
        <div className="tw-space-y-4">
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-4 tw-rounded-lg tw-border tw-border-solid tw-border-border tw-p-3">
            <div className="tw-min-w-0">
              <div className="tw-text-sm tw-font-medium">{t('settings:automaticallyCompactContext')}</div>
              <div className="tw-text-xs tw-text-muted-foreground">
                {t('settings:autoCompactionDescription')}
              </div>
            </div>
            <SettingSwitch
              checked={autoContextCompaction}
              onCheckedChange={setAutoContextCompaction}
            />
          </div>
          <ModelVariantSelect
            label={t('settings:defaultAgentModel')}
            models={models}
            selectedModelId={defaultAgentModel?.id ?? null}
            variant={defaultAgentModelVariant}
            fallbackModel={models[0] ?? null}
            fallbackLabel={t('settings:firstAvailableModel')}
            onChange={(modelId, variant) => setDefaultAgentModel(
              modelId ? models.find((model) => model.id === modelId) ?? null : null,
              variant,
            )}
          />
          <ModelVariantSelect
            label={t('settings:titleGenerationModel')}
            models={models}
            selectedModelId={titleModel?.id ?? null}
            variant={titleModelVariant}
            fallbackModel={defaultAgentModel ?? models[0] ?? null}
            fallbackLabel={t('settings:defaultAgentModelFallback')}
            showVariants={false}
            onChange={(modelId) => setTitleModel(
              modelId ? models.find((model) => model.id === modelId) ?? null : null,
              null,
            )}
          />
          <ModelVariantSelect
            label={t('settings:imageAnalysisModel')}
            models={models}
            selectedModelId={imageModel?.id ?? null}
            variant={imageModelVariant}
            fallbackModel={defaultAgentModel ?? models[0] ?? null}
            fallbackLabel={t('settings:defaultAgentModelFallback')}
            showVariants={false}
            onChange={(modelId) => setImageModel(
              modelId ? models.find((model) => model.id === modelId) ?? null : null,
              null,
            )}
          />
        </div>
      </section>

      <VaultRagIndexSetting />
    </div>
  );
};
