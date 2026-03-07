import { ArrowUp, ChevronDown, Loader2, StopCircle, Image } from "lucide-react";
import { Button } from "../../../elements/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../elements/dropdown-menu";
import { useState, useRef } from "react";
import { useAgentLogic, useAgentState } from "../../../../hooks/use-agent";
import { useSettingsState } from "../../../../hooks/use-settings";
import { useApp } from "@/hooks/app-context";
import { Notice } from "obsidian";
import { MAX_IMAGE_SIZE } from "./cm-config/utils";

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
  const { model } = useAgentState();
  const { setModel } = useAgentLogic();
  const { models } = useSettingsState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const app = useApp();

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
      <div>
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