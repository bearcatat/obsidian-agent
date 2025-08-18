import { ModelAddOrUpdateDialog } from "./ModelAddOrUpdateDialog";
import { useState } from "react";
import { ModelTable } from "./model-table";
import { ModelConfig } from "@/types";
import { useSettingsState, useSettingsLogic } from "@/hooks/use-settings";
import { FormField } from "@/ui/elements/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";

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
  
  const { models, defaultAgentModel, titleModel } = useSettingsState();
  const { setDefaultAgentModel, setTitleModel } = useSettingsLogic();
  
  return (
    <div className="tw-space-y-6">
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
          <div className="tw-flex tw-items-center tw-gap-4">
            <label className="tw-text-sm tw-font-medium tw-text-gray-700 tw-w-64">Default Agent Model</label>
            <Select 
              value={defaultAgentModel?.id || "none"} 
              onValueChange={(value) => {
                const model = value === "none" ? null : models.find(m => m.id === value) || null;
                setDefaultAgentModel(model);
              }}
            >
              <SelectTrigger className="tw-w-48">
                <SelectValue placeholder="Select default agent model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (use first available)</SelectItem>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="tw-flex tw-items-center tw-gap-4">
            <label className="tw-text-sm tw-font-medium tw-text-gray-700 tw-w-64">Title Generation Model</label>
            <Select 
              value={titleModel?.id || "default"} 
              onValueChange={(value) => {
                const model = value === "default" ? null : models.find(m => m.id === value) || null;
                setTitleModel(model);
              }}
            >
              <SelectTrigger className="tw-w-48">
                <SelectValue placeholder="Select title generation model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use default agent model</SelectItem>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
};