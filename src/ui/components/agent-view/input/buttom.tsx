import { ArrowUp, ChevronDown, Loader2, StopCircle, Image, Activity } from "lucide-react";
import { Button } from "../../../elements/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../elements/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../elements/tooltip";
import { useState, useRef } from "react";
import { useAgentLogic, useAgentState } from "../../../../hooks/use-agent";
import { useSettingsState } from "../../../../hooks/use-settings";
import { useApp } from "@/hooks/app-context";
import { Notice } from "obsidian";
import { MAX_IMAGE_SIZE } from "./cm-config/utils";
import { getAvailableVariants, ModelVariant } from "@/types";

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

interface InputButtomGenerateProps {
  onStopGenerating: () => void;
}

const InputButtomGenerate: React.FC<InputButtomGenerateProps> = ({
  onStopGenerating = () => { },
}) => {
  return (
    <div className="tw-flex tw-h-6 tw-justify-between tw-gap-1 tw-px-1">
      <div className="tw-flex tw-items-center tw-gap-1 tw-px-1 tw-text-sm tw-text-faint">
        <Loader2 className="tw-size-3 tw-animate-spin" />
        <span>Generating...</span>
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
  const [isVariantDropdownOpen, setIsVariantDropdownOpen] = useState(false);
  const { model, messages, variant } = useAgentState();
  const { setModel, setVariant } = useAgentLogic();
  const { models } = useSettingsState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const app = useApp();

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

  return (
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
              {model?.id || "Select Model"}
              <ChevronDown className="tw-mt-0.5 tw-size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {models.map((model) => (
              <DropdownMenuItem key={model.id} onSelect={() => setModel(model)}>
                {model.id}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {(() => {
          const variants = model ? getAvailableVariants(model) : null;
          if (!variants) return null;
          return (
            <DropdownMenu open={isVariantDropdownOpen} onOpenChange={setIsVariantDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost2" size="fit">
                  {variant ? variants.find(v => v.value === variant)?.label ?? 'Thinking' : 'Thinking'}
                  <ChevronDown className="tw-mt-0.5 tw-size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {variants.map((v) => (
                  <DropdownMenuItem key={v.value} onSelect={() => setVariant(v.value)}>
                    {v.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })()}
      </div>
      <div className="tw-flex tw-items-center">
        {lastUsage && lastUsage.totalTokens && (
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