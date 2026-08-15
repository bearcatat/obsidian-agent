import { ArrowUp, ChevronDown, Loader2, StopCircle, Image, Activity, RotateCcw, Copy, Settings2 } from "lucide-react";
import { Button } from "../../../elements/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "../../../elements/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../elements/tooltip";
import { useState, useRef } from "react";
import { useAgentLogic, useAgentState } from "../../../../hooks/use-agent";
import { useSettingsState } from "../../../../hooks/use-settings";
import { useApp } from "@/hooks/app-context";
import { Notice } from "obsidian";
import { MAX_IMAGE_SIZE } from "./cm-config/utils";
import { getAvailableVariants, ModelConfig, ModelVariant } from "@/types";

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'];
const IMAGE_MIME_TYPES = 'image/png,image/jpeg,image/gif,image/webp,image/bmp,image/svg+xml,image/x-icon';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const isValidImageFile = (file: File): boolean => {
  const ext = '.' + file.name.toLowerCase().split('.').pop();
  return IMAGE_EXTENSIONS.includes(ext);
};

const formatTokens = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

const getModelVariantLabel = (modelConfig: ModelConfig, variant: ModelVariant | null) => {
  const variants = getAvailableVariants(modelConfig);
  if (!variants || !variant) {
    return modelConfig.id;
  }

  const selectedVariant = variants.find((option) => option.value === variant);
  if (!selectedVariant) {
    return modelConfig.id;
  }

  return `${modelConfig.id} | ${selectedVariant.label}`;
};

interface InputButtomGenerateProps {
  onStopGenerating: () => void;
}

const InputButtomGenerate: React.FC<InputButtomGenerateProps> = ({
  onStopGenerating = () => { },
}) => {
  const { contextRuntimeState } = useAgentState();
  const statusLabel = contextRuntimeState.status === 'compacting'
    ? '正在压缩上下文'
    : contextRuntimeState.status === 'estimating'
      ? '正在估算上下文'
      : contextRuntimeState.message || 'Generating...';
  return (
    <div className="tw-flex tw-h-6 tw-justify-between tw-gap-1 tw-px-1">
      <div className="tw-flex tw-items-center tw-gap-1 tw-px-1 tw-text-sm tw-text-faint">
        <Loader2 className="tw-size-3 tw-animate-spin" />
        <span>{statusLabel}</span>
      </div>
      <Button
        variant="ghost2"
        size="fit"
        className="tw-text-muted"
        onClick={() => onStopGenerating()}
      >
        <StopCircle className="tw-size-4" />
        Stop
      </Button>
    </div>
  )
}

interface InputButtomSendProps {
  onSend: () => void;
  onAddImages?: (images: string[]) => void;
}

const InputButtomSend: React.FC<InputButtomSendProps> = ({
  onSend,
  onAddImages,
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const { model, messages, variant, contextRuntimeState, contextCheckpoint } = useAgentState();
  const { setModel, retryContextCompaction } = useAgentLogic();
  const { models } = useSettingsState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const app = useApp();
  const contextWindow = model?.contextWindow;
  const estimatedContextTokens = contextRuntimeState.estimatedInputTokens;
  const contextPercent = contextWindow && estimatedContextTokens
    ? Math.min(999, Math.round((estimatedContextTokens / contextWindow) * 100))
    : undefined;

  const assistantMessages = messages.filter(m => m.role === 'assistant' && (m as any).usage);
  
  let totalSessionTokens = 0;
  assistantMessages.forEach(m => {
    const usage = (m as any).usage;
    if (usage?.totalTokens) totalSessionTokens += usage.totalTokens;
  });

  const lastUsage = assistantMessages.length > 0 
    ? (assistantMessages[assistantMessages.length - 1] as any).usage 
    : null;

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    let oversizedFiles: string[] = [];

    for (const file of Array.from(files)) {
      if (!isValidImageFile(file)) continue;
      if (file.size > MAX_IMAGE_SIZE) {
        oversizedFiles.push(file.name);
        continue;
      }
      validFiles.push(file);
    }

    if (oversizedFiles.length > 0) {
      const fileList = oversizedFiles.join(', ');
      new Notice(`图片超过 5MB 限制: ${fileList}`, 3000);
    }

    if (validFiles.length > 0 && onAddImages) {
      const base64Images = await Promise.all(validFiles.map(fileToBase64));
      onAddImages(base64Images);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openModelSettings = () => {
    const setting = (app as any)?.setting;
    setting?.open?.();
    setting?.openTabById?.('obsidian-agent');
  };

  const copyContextError = async () => {
    if (!contextRuntimeState.lastError) return;
    await navigator.clipboard.writeText(contextRuntimeState.lastError);
    new Notice('Context error copied.');
  };

  return (
    <div className="tw-flex tw-flex-col tw-gap-1">
      {contextRuntimeState.status === 'error' && contextRuntimeState.lastError && (
        <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-justify-between tw-gap-1 tw-rounded tw-bg-error/10 tw-px-2 tw-py-1 tw-text-xs tw-text-error">
          <span className="tw-min-w-0 tw-flex-1 tw-truncate" title={contextRuntimeState.lastError}>
            {contextRuntimeState.message || '压缩失败'}: {contextRuntimeState.lastError}
          </span>
          <span className="tw-flex tw-shrink-0 tw-items-center tw-gap-1">
            {contextRuntimeState.retryable && (
              <Button variant="ghost2" size="fit" onClick={() => void retryContextCompaction()}>
                <RotateCcw className="tw-size-3" /> Retry
              </Button>
            )}
            <Button variant="ghost2" size="fit" onClick={openModelSettings}>
              <Settings2 className="tw-size-3" /> Settings
            </Button>
            <Button variant="ghost2" size="fit" onClick={() => void copyContextError()} aria-label="Copy context error">
              <Copy className="tw-size-3" />
            </Button>
          </span>
        </div>
      )}
      <div className="tw-flex tw-h-6 tw-justify-between tw-gap-1 tw-px-1">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={IMAGE_MIME_TYPES}
        onChange={handleImageSelect}
        className="tw-hidden"
      />
      <div className="tw-flex tw-items-center">
        <DropdownMenu open={isModelDropdownOpen} onOpenChange={setIsModelDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost2" size="fit">
              {model ? getModelVariantLabel(model, variant) : "Select Model"}
              <ChevronDown className="tw-mt-0.5 tw-size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {models.map((modelOption) => {
              const variants = getAvailableVariants(modelOption);
              if (!variants) {
                return (
                  <DropdownMenuItem key={modelOption.id} onSelect={() => setModel(modelOption)}>
                    {modelOption.id}
                  </DropdownMenuItem>
                );
              }

              return (
                <DropdownMenuSub key={modelOption.id}>
                  <DropdownMenuSubTrigger>
                    {modelOption.id}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {variants.map((variantOption) => (
                      <DropdownMenuItem
                        key={variantOption.value}
                        onSelect={() => setModel(modelOption, variantOption.value)}
                      >
                        {variantOption.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="tw-flex tw-items-center">
        {(model || (lastUsage && lastUsage.totalTokens)) && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost2"
                  size="fit"
                  className="tw-text-muted tw-cursor-help"
                >
                  <Activity className="tw-size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="tw-flex tw-flex-col tw-gap-1.5 tw-text-xs">
                  <div className="tw-flex tw-justify-between tw-items-center tw-gap-8 group">
                    <span className="tw-text-muted">Active context</span>
                    <span className="tw-font-mono" title={estimatedContextTokens?.toString()}>
                      {contextWindow
                        ? `${estimatedContextTokens ? formatTokens(estimatedContextTokens) : '—'} / ${formatTokens(contextWindow)}${contextPercent !== undefined ? ` (${contextPercent}%)` : ''}`
                        : 'Context window not configured'}
                    </span>
                  </div>
                  {contextRuntimeState.message && (
                    <div className="tw-max-w-[320px] tw-text-muted">{contextRuntimeState.message}</div>
                  )}
                  {contextCheckpoint && (
                    <div className="tw-flex tw-justify-between tw-items-center tw-gap-8 group">
                      <span className="tw-text-muted">Last compacted</span>
                      <span>{new Date(contextCheckpoint.createdAt).toLocaleString()}</span>
                    </div>
                  )}
                  {lastUsage && lastUsage.totalTokens && <div className="tw-h-px tw-w-full tw-bg-border tw-my-1" />}
                  {lastUsage && lastUsage.totalTokens && (
                    <>
                  <div className="tw-flex tw-justify-between tw-items-center tw-gap-8 group">
                    <span className="tw-text-muted">Input</span>
                    <span className="tw-font-mono" title={(lastUsage.inputTokens || 0).toString()}>{formatTokens(lastUsage.inputTokens || 0)}</span>
                  </div>
                  
                  <div className="tw-flex tw-justify-between tw-items-center tw-gap-8 group">
                    <span className="tw-text-muted">Output</span>
                    <span className="tw-font-mono" title={(lastUsage.outputTokens || 0).toString()}>{formatTokens(lastUsage.outputTokens || 0)}</span>
                  </div>
                  
                  {((lastUsage.cacheReadTokens || 0) + (lastUsage.cacheWriteTokens || 0)) > 0 && (
                    <div className="tw-flex tw-justify-between tw-items-center tw-gap-8 group">
                      <span className="tw-text-muted">Cached</span>
                      <span className="tw-font-mono" title={((lastUsage.cacheReadTokens || 0) + (lastUsage.cacheWriteTokens || 0)).toString()}>
                        {formatTokens((lastUsage.cacheReadTokens || 0) + (lastUsage.cacheWriteTokens || 0))}
                      </span>
                    </div>
                  )}
                  
                  <div className="tw-h-px tw-w-full tw-bg-border tw-my-1" />
                  
                  <div className="tw-flex tw-justify-between tw-items-center tw-gap-8 group">
                    <span className="tw-text-muted">Total</span>
                    <span className="tw-font-mono tw-font-medium" title={totalSessionTokens.toString()}>{formatTokens(totalSessionTokens)}</span>
                  </div>
                    </>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Button
          variant="ghost2"
          size="fit"
          className="tw-text-muted"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Add images from file"
        >
          <Image className="tw-size-4" />
        </Button>
        <Button
          variant="ghost2"
          size="fit"
          className="tw-text-muted"
          onClick={() => {
            onSend();
          }}
        >
          <ArrowUp className="!tw-size-4" />
        </Button>
      </div>
      </div>
    </div>
  )
}

interface InputButtomProps {
  onSend: () => void;
  onAddImages?: (images: string[]) => void;
}

export const InputButtom: React.FC<InputButtomProps> = ({
  onSend,
  onAddImages,
}) => {
  const { isLoading } = useAgentState();
  const { stopLoading } = useAgentLogic();
  return (
    <>
      {isLoading ? (
        <InputButtomGenerate onStopGenerating={stopLoading} />
      ) : (
        <InputButtomSend onSend={onSend} onAddImages={onAddImages} />
      )}
    </>
  )
}
