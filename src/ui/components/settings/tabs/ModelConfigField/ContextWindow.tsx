import { ModelConfig } from "@/types";
import { FormField } from "@/ui/elements/form-field";
import { Input } from "@/ui/elements/input";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/elements/tooltip";
import { t } from "@/i18n";

export const ContextWindow = ({ model, setModel }: {
  model: ModelConfig;
  setModel: (model: ModelConfig) => void;
}) => {
  const invalid = model.contextWindow !== undefined
    && model.maxTokens !== undefined
    && model.contextWindow <= model.maxTokens;

  return (
    <FormField
      error={invalid}
      errorMessage={t("settings:contextWindowError")}
      label={
        <div className="tw-flex tw-items-center tw-gap-2">
          {t("settings:contextWindow")}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="tw-size-4 tw-text-muted" />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="tw-w-[300px]">
                  {t("settings:contextWindowHelp")}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      }
    >
      <Input
        type="number"
        min={1}
        step={1024}
        placeholder={t("settings:unknown")}
        value={model.contextWindow ?? ''}
        onChange={(event) => {
          const raw = event.target.value.trim();
          const value = raw ? Math.floor(Number(raw)) : undefined;
          setModel({
            ...model,
            contextWindow: value && Number.isFinite(value) && value > 0 ? value : undefined,
          });
        }}
      />
    </FormField>
  );
};
