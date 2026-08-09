import { ModelAddOrUpdateDialog } from "./ModelAddOrUpdateDialog";
import { useState } from "react";
import { ModelTable } from "./model-table";
import { ModelConfig } from "@/types";
import { useSettingsState, useSettingsLogic } from "@/hooks/use-settings";
import { ModelVariantSelect } from "../model-variant-select";

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
  } = useSettingsState();
  const { setDefaultAgentModel, setTitleModel, setImageModel } = useSettingsLogic();
  
  return (
    <div className="tw-min-w-0 tw-max-w-full tw-space-y-6">
      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">Chat Models</div>
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
        <div className="tw-mb-3 tw-text-xl tw-font-bold">Model Settings</div>
        <div className="tw-space-y-4">
          <ModelVariantSelect
            label="Default Agent Model"
            models={models}
            selectedModelId={defaultAgentModel?.id ?? null}
            variant={defaultAgentModelVariant}
            fallbackModel={models[0] ?? null}
            fallbackLabel="First available model"
            onChange={(modelId, variant) => setDefaultAgentModel(
              modelId ? models.find((model) => model.id === modelId) ?? null : null,
              variant,
            )}
          />
          <ModelVariantSelect
            label="Title Generation Model"
            models={models}
            selectedModelId={titleModel?.id ?? null}
            variant={titleModelVariant}
            fallbackModel={defaultAgentModel ?? models[0] ?? null}
            fallbackLabel="Default agent model"
            showVariants={false}
            onChange={(modelId) => setTitleModel(
              modelId ? models.find((model) => model.id === modelId) ?? null : null,
              null,
            )}
          />
          <ModelVariantSelect
            label="Image Analysis Model"
            models={models}
            selectedModelId={imageModel?.id ?? null}
            variant={imageModelVariant}
            fallbackModel={defaultAgentModel ?? models[0] ?? null}
            fallbackLabel="Default agent model"
            showVariants={false}
            onChange={(modelId) => setImageModel(
              modelId ? models.find((model) => model.id === modelId) ?? null : null,
              null,
            )}
          />
        </div>
      </section>
    </div>
  );
};
