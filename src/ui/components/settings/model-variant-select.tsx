import React from "react";
import { ModelConfig, ModelVariant, getAvailableVariants, resolveModelVariant } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/ui/elements/dropdown-menu";
import { SettingDropdownTrigger } from "./setting-dropdown-trigger";

interface ModelVariantSelectProps {
  label: string;
  models: ModelConfig[];
  selectedModelId: string | null;
  variant: ModelVariant | null;
  fallbackModel: ModelConfig | null;
  fallbackLabel: string;
  showVariants?: boolean;
  onChange: (modelId: string | null, variant: ModelVariant | null) => void | Promise<void>;
}

export const ModelVariantSelect: React.FC<ModelVariantSelectProps> = ({
  label,
  models,
  selectedModelId,
  variant,
  fallbackModel,
  fallbackLabel,
  showVariants = true,
  onChange,
}) => {
  const configuredModel = selectedModelId
    ? models.find((model) => model.id === selectedModelId) ?? null
    : null;
  const selectedModel = configuredModel ?? fallbackModel;
  const selectedVariant = selectedModel && showVariants ? resolveModelVariant(selectedModel, variant) : null;
  const selectedVariantLabel = selectedModel
    ? getAvailableVariants(selectedModel)?.find((option) => option.value === selectedVariant)?.label
    : undefined;
  const selectedLabel = selectedModel
    ? `${configuredModel ? selectedModel.id : `${fallbackLabel} | ${selectedModel.id}`}${selectedVariantLabel ? ` | ${selectedVariantLabel}` : ""}`
    : "No model configured";

  const modelMenuItem = (
    key: string,
    modelId: string | null,
    model: ModelConfig,
    itemLabel = model.id,
  ) => {
    const variants = showVariants ? getAvailableVariants(model) : null;
    if (!variants) {
      return (
        <DropdownMenuItem key={key} onSelect={() => void onChange(modelId, null)}>
          {itemLabel}
        </DropdownMenuItem>
      );
    }

    return (
      <DropdownMenuSub key={key}>
        <DropdownMenuSubTrigger>{itemLabel}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {variants.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => void onChange(modelId, option.value)}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  };

  return (
    <div className="tw-flex tw-min-w-0 tw-items-center tw-justify-between tw-gap-4">
      <span className="tw-min-w-0 tw-text-sm">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SettingDropdownTrigger>{selectedLabel}</SettingDropdownTrigger>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="tw-max-w-[calc(100vw-2rem)]">
          {fallbackModel && modelMenuItem("fallback", null, fallbackModel, fallbackLabel)}
          {models.map((model) => modelMenuItem(`model-${model.id}`, model.id, model))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
