import { ModelAddOrUpdateDialog } from "./ModelAddOrUpdateDialog";
import { useState } from "react";
import { ModelTable } from "./model-table";
import { ModelConfig } from "@/types";

export const ModelSetting: React.FC = () => {
  const _initialModel = {
    id: "",
    name: "",
    provider: "",
    baseUrl: "",
    apiKey: "",
    temperature: 0.5,
    maxTokens: 8192, // 增加默认值以支持 thinking 功能
    topP: 0.5,
    frequencyPenalty: 0.5,
  } as ModelConfig;
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [initialModel, setInitialModel] = useState<ModelConfig>(_initialModel);
  const [isUpdate, setIsUpdate] = useState(false);
  
  return (
    <div className="tw-space-y-4">
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
    </div>
  );
};