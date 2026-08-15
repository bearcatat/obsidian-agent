import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/elements/dialog";
import { useTab } from "@/hooks/TabContext";
import { ExternalToolId } from "./external-tools-table";
import { ExaConfig } from "./external-tool-configs/exa-config";
import { BochaConfig } from "./external-tool-configs/bocha-config";
import { TelegramFeedbackConfig } from "./external-tool-configs/telegram-feedback-config";
import { t } from "@/i18n";

interface ExternalToolDialogProps {
  toolId: ExternalToolId | null;
  open: boolean;
  close: () => void;
}

const toolInfo: Record<ExternalToolId, { nameKey: string; descriptionKey: string }> = {
  exa: {
    nameKey: "exaWebSearch",
    descriptionKey: "configureExa",
  },
  bocha: {
    nameKey: "bochaWebSearch",
    descriptionKey: "configureBocha",
  },
  telegram: {
    nameKey: "telegramFeedback",
    descriptionKey: "configureTelegram",
  },
};

export const ExternalToolDialog: React.FC<ExternalToolDialogProps> = ({
  toolId,
  open,
  close,
}) => {
  const { modalContainer } = useTab();
  const [dialogElement, setDialogElement] = useState<HTMLDivElement | null>(null);

  if (!toolId) return null;

  const info = toolInfo[toolId];

  return (
    <Dialog open={open} onOpenChange={(open) => !open && close()}>
      <DialogContent
        ref={(element: HTMLDivElement | null) => setDialogElement(element)}
        container={modalContainer}
        className="sm:tw-max-w-[500px]"
      >
        <DialogHeader>
          <DialogTitle>{t(`settings:${info.nameKey}`)}</DialogTitle>
          <DialogDescription>{t(`settings:${info.descriptionKey}`)}</DialogDescription>
        </DialogHeader>
        
        {toolId === "exa" && <ExaConfig onSave={close} dialogElement={dialogElement} />}
        {toolId === "bocha" && <BochaConfig onSave={close} dialogElement={dialogElement} />}
        {toolId === "telegram" && <TelegramFeedbackConfig onSave={close} dialogElement={dialogElement} />}
      </DialogContent>
    </Dialog>
  );
};
