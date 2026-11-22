import { ModelAddOrUpdateDialog } from "./ModelAddOrUpdateDialog";
import { useState } from "react";
import { ModelTable } from "./model-table";
import { ModelConfig } from "@/types";
import { useSettingsState, useSettingsLogic } from "@/hooks/use-settings";
import { ModelVariantSelect } from "../model-variant-select";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { t } from "../../../../i18n";
import { Input } from '@/ui/elements/input';
import { Button } from '@/ui/elements/button';
import { selectableModels } from '@/llm/selectable-model-utils';

export const ModelSetting: React.FC = () => {
  const _initialModel = {
    id: "",
    name: "",
    provider: "",
    connectionMode: 'official',
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
  const [deepSeekKey, setDeepSeekKey] = useState('');
  const [isEditingDeepSeekKey, setIsEditingDeepSeekKey] = useState(false);
  
  const {
    models,
    defaultAgentModel,
    defaultAgentModelVariant,
    titleModel,
    titleModelVariant,
    imageModel,
    imageModelVariant,
    autoContextCompaction,
    officialModelCatalog,
  } = useSettingsState();
  const { setDefaultAgentModel, setTitleModel, setImageModel, setAutoContextCompaction, getOfficialModels, setDeepSeekOfficialSecret } = useSettingsLogic();
  const officialModels = getOfficialModels();
  const hasDeepSeekKey = officialModels.length > 0;
  const allModels = selectableModels(officialModels, models);
  
  return (
    <div className="tw-min-w-0 tw-max-w-full tw-space-y-6">
      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">{t('settings:officialProviders')}</div>
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-border-b tw-[border-bottom-style:solid] tw-border-border tw-px-1 tw-pb-3">
          <div className="tw-font-medium">DeepSeek</div>
          {officialModels.length > 0 && <div className="tw-text-xs tw-text-muted">{t('settings:secretStored')}</div>}
          <div className="tw-ml-auto tw-flex tw-min-w-[220px] tw-flex-1 tw-items-center tw-justify-end tw-gap-2">
            {(!hasDeepSeekKey || isEditingDeepSeekKey) && <Input type="password" value={deepSeekKey} onChange={(event) => setDeepSeekKey(event.target.value)} placeholder={t('settings:deepseekApiKeyPlaceholder')} />}
            <Button onClick={() => {
              if (hasDeepSeekKey && !isEditingDeepSeekKey) { setIsEditingDeepSeekKey(true); return; }
              void setDeepSeekOfficialSecret(deepSeekKey).then(() => { setDeepSeekKey(''); setIsEditingDeepSeekKey(false); });
            }}>{hasDeepSeekKey && !isEditingDeepSeekKey ? t('settings:changeOfficialKey') : t('common:save')}</Button>
            {hasDeepSeekKey && <Button variant="ghost" onClick={() => void setDeepSeekOfficialSecret('').then(() => { setDeepSeekKey(''); setIsEditingDeepSeekKey(false); })}>{t('common:clear')}</Button>}
          </div>
        </div>
        <div className="tw-mt-1 tw-text-xs tw-text-muted">{t('settings:officialSecretDescription')}</div>
      </section>
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
            models={allModels}
            selectedModelId={defaultAgentModel?.id ?? null}
            variant={defaultAgentModelVariant}
            fallbackModel={allModels[0] ?? null}
            fallbackLabel={t('settings:firstAvailableModel')}
            onChange={(modelId, variant) => setDefaultAgentModel(
              modelId ? allModels.find((model) => model.id === modelId) ?? null : null,
              variant,
            )}
          />
          <ModelVariantSelect
            label={t('settings:titleGenerationModel')}
            models={allModels}
            selectedModelId={titleModel?.id ?? null}
            variant={titleModelVariant}
            fallbackModel={defaultAgentModel ?? allModels[0] ?? null}
            fallbackLabel={t('settings:defaultAgentModelFallback')}
            showVariants={false}
            onChange={(modelId) => setTitleModel(
              modelId ? allModels.find((model) => model.id === modelId) ?? null : null,
              null,
            )}
          />
          <ModelVariantSelect
            label={t('settings:imageAnalysisModel')}
            models={allModels}
            selectedModelId={imageModel?.id ?? null}
            variant={imageModelVariant}
            fallbackModel={defaultAgentModel ?? allModels[0] ?? null}
            fallbackLabel={t('settings:defaultAgentModelFallback')}
            showVariants={false}
            onChange={(modelId) => setImageModel(
              modelId ? allModels.find((model) => model.id === modelId) ?? null : null,
              null,
            )}
          />
        </div>
      </section>
    </div>
  );
};
