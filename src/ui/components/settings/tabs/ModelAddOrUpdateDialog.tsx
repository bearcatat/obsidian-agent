import React, { useCallback, useEffect, useState } from "react";
import { useTab } from "@/hooks/TabContext";
import { ModelConfig, ModelProviders } from "@/types";
import { Input } from "@/ui/elements/input";
import { Button } from "@/ui/elements/button";
import { HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/elements/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { PasswordInput } from "@/ui/elements/password-input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/elements/tooltip";
import { FormField } from "@/ui/elements/form-field";
import { SettingSlider } from "@/ui/elements/setting-slider";
import { debounce } from "@/ui/components/utils";
import { useSettingsLogic } from "@/hooks/use-settings";
import { CommonModelConfig } from "./ProviderModelConfig/CommonModelConfig";
import { ProviderModelConfig } from "./ProviderModelConfig/ProviderModelConfig";


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
  const { addOrUpdateModel } = useSettingsLogic();


  useEffect(() => {
    setModel(initialModel);
  }, [initialModel]);

  // Clean up model data by trimming whitespace
  const getCleanedModel = (modelData: ModelConfig): ModelConfig => {
    return {
      ...modelData,
      id: modelData.id?.trim(),
      name: modelData.name?.trim(),
      baseUrl: modelData.baseUrl?.trim(),
      apiKey: modelData.apiKey?.trim(),
    };
  };

  const onSave = async () => {
    const cleanedModel = getCleanedModel(model);
    try {
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
        className="sm:tw-max-w-[425px]"
        container={modalContainer}
        ref={(el: HTMLDivElement | null) => setDialogElement(el)}
      >
        <DialogHeader>
          <DialogTitle>{isUpdate ? "Update Model" : "Add Model"}</DialogTitle>
          <DialogDescription>{isUpdate ? "Update existing model in your collection." : "Add a new model to your collection."}</DialogDescription>
        </DialogHeader>
        <CommonModelConfig model={model} setModel={setModel} dialogElement={dialogElement}></CommonModelConfig>
        <ProviderModelConfig model={model} debouncedSetModel={debouncedSetModel}></ProviderModelConfig>

        <div className="tw-flex tw-items-center tw-justify-end tw-gap-4">
          <div className="tw-flex tw-gap-2">
            <Button variant="secondary" onClick={onSave}>
              Save Model
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
