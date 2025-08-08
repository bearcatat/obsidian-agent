import { ArrowUp, ChevronDown, Loader2, StopCircle } from "lucide-react";
import { Button } from "../../../elements/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../elements/dropdown-menu";
import { useState } from "react";
import { useAgentLogic, useAgentState } from "../../../../hooks/use-agent";
import { useSettingsState } from "../../../../hooks/use-settings";

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
}

const InputButtomSend: React.FC<InputButtomSendProps> = ({
  onSend,
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const { model } = useAgentState();
  const { setModel } = useAgentLogic();
  const { models } = useSettingsState();

  return (
    <div className="tw-flex tw-h-6 tw-justify-between tw-gap-1 tw-px-1">
      <DropdownMenu open={isModelDropdownOpen} onOpenChange={setIsModelDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost2" size="fit">
            {model?.id || "Select Model"}
            <ChevronDown className="tw-mt-0.5 tw-size-5" />
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
      <Button
        variant="ghost2"
        size="fit"
        className="tw-text-muted"
        onClick={() => {
          onSend();
        }}
      >
        <ArrowUp className="!tw-size-3" />
      </Button>
    </div>
  )
}

interface InputButtomProps {
  onSend: () => void;
}

export const InputButtom: React.FC<InputButtomProps> = ({
  onSend,
}) => {
  const { isLoading } = useAgentState();
  const { stopLoading } = useAgentLogic();
  return (
    <>
      {isLoading ? (
        <InputButtomGenerate onStopGenerating={stopLoading} />
      ) : (
        <InputButtomSend onSend={onSend} />
      )}
    </>
  )
}