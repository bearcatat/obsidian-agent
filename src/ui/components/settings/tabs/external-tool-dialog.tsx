import React, { useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/elements/dialog";
import { ExternalToolId } from "./external-tools-table";
import { ExaConfig } from "./external-tool-configs/exa-config";
import { BochaConfig } from "./external-tool-configs/bocha-config";

interface ExternalToolDialogProps {
  toolId: ExternalToolId | null;
  open: boolean;
  close: () => void;
}

const toolInfo: Record<ExternalToolId, { name: string; description: string }> = {
  exa: {
    name: "Exa Web Search",
    description: "Configure Exa AI web search.",
  },
  bocha: {
    name: "Bocha Web Search",
    description: "Configure Bocha AI web search.",
  },
};

export const ExternalToolDialog: React.FC<ExternalToolDialogProps> = ({
  toolId,
  open,
  close,
}) => {
  const dialogContentRef = useRef<HTMLDivElement>(null);

  if (!toolId) return null;

  const info = toolInfo[toolId];

  return (
    <Dialog open={open} onOpenChange={(open) => !open && close()}>
      <DialogContent ref={dialogContentRef} className="sm:tw-max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{info.name}</DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>
        
        {toolId === "exa" && <ExaConfig onSave={close} dialogElement={dialogContentRef.current} />}
        {toolId === "bocha" && <BochaConfig onSave={close} dialogElement={dialogContentRef.current} />}
      </DialogContent>
    </Dialog>
  );
};
