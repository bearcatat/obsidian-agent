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

        <div className="tw-space-y-3">
          <FormField
            label="Display Name(ID)"
            required
          >
            <Input
              type="text"
              placeholder="Display Name(ID)"
              value={model.id || ""}
              onChange={(e) => setModel({ ...model, id: e.target.value })}
            />
          </FormField>

          <FormField
            label="Model Name"
            required
          >
            <Input
              type="text"
              placeholder={`Enter model name (e.g. "gpt-4")`}
              value={model.name}
              onChange={(e) => setModel({ ...model, name: e.target.value })}
            />
          </FormField>

          <FormField label="Provider">
            <Select value={model.provider} onValueChange={(value) => setModel({ ...model, provider: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent container={dialogElement}>
                {Object.values(ModelProviders).map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Base URL">
            <Input
              type="text"
              placeholder={"https://api.example.com/v1"}
              value={model.baseUrl}
              onChange={(e) => setModel({ ...model, baseUrl: e.target.value })}
            />
          </FormField>

          <FormField label="API Key">
            <PasswordInput
              placeholder={`Enter API Key`}
              value={model.apiKey || ""}
              onChange={(value) => setModel({ ...model, apiKey: value })}
            />
          </FormField>
        </div>

        <FormField
          label={
            <div className="tw-flex tw-items-center tw-gap-2">
              Token limit
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="tw-size-4 tw-text-muted" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="tw-w-[300px]">
                      <p>
                        The maximum number of <em>output tokens</em> to generate. Default is{" "}
                        {8192}.
                      </p>
                      <em>
                        This number plus the length of your prompt (input tokens) must be
                        smaller than the context window of the model.
                      </em>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          }
        >
          <SettingSlider
            value={
              model.maxTokens ?? 8192
            }
            onChange={(value) => debouncedSetModel({ ...model, maxTokens: value })}
            min={0}
            max={65000}
            step={100}
          />
        </FormField>

        <FormField
          label={
            <div className="tw-flex tw-items-center tw-gap-2">
              Temperature
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="tw-size-4 tw-text-muted" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="tw-max-w-[300px]">
                      Default is {0.7}. Higher values will result
                      in more creativeness, but also more mistakes. Set to 0 for no randomness.
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          }
        >
          <SettingSlider
            value={
              model.temperature ?? 0.7
            }
            onChange={(value) => debouncedSetModel({ ...model, temperature: value })}
            max={2}
            min={0}
            step={0.05}
          />
        </FormField>

        <FormField
          label={
            <div className="tw-flex tw-items-center tw-gap-2">
              Top-P
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="tw-size-4 tw-text-muted" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="tw-w-[300px]">
                      Default value is 0.9, the smaller the value, the less variety in the
                      answers, the easier to understand, the larger the value, the larger the
                      range of the Al&#39;s vocabulary, the more diverse
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          }
        >
          <SettingSlider
            value={model.topP ?? 0.9}
            onChange={(value) => debouncedSetModel({ ...model, topP: value })}
            max={1}
            min={0}
            step={0.05}
          />
        </FormField>

        <FormField
          label={
            <div className="tw-flex tw-items-center tw-gap-2">
              Frequency Penalty
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="tw-size-4 tw-text-muted" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="tw-w-[300px]">
                      <p>
                        The frequency penalty parameter tells the model not to repeat a word
                        that has already been used multiple times in the conversation.
                      </p>
                      <em>
                        The higher the value, the more the model is penalized for repeating
                        words.
                      </em>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          }
        >
          <SettingSlider
            value={model.frequencyPenalty ?? 0}
            onChange={(value) => debouncedSetModel({ ...model, frequencyPenalty: value })}
            max={2}
            min={0}
            step={0.05}
          />
        </FormField>

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
