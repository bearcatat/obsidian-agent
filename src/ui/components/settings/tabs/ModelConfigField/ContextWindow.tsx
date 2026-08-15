import { ModelConfig } from "@/types";
import { FormField } from "@/ui/elements/form-field";
import { Input } from "@/ui/elements/input";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/elements/tooltip";

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
      errorMessage="Context window must be larger than Max Output Tokens."
      label={
        <div className="tw-flex tw-items-center tw-gap-2">
          Context Window
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="tw-size-4 tw-text-muted" />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="tw-w-[300px]">
                  Total input + output token capacity for this model. Leave empty when unknown. Automatic preflight compaction only runs when this value is configured.
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
        placeholder="Unknown"
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
