import { ChevronDown } from "lucide-react";
import { BashApprovalMode } from "@/types";
import { Button } from "@/ui/elements/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/elements/dropdown-menu";

export const BASH_APPROVAL_MODES: readonly BashApprovalMode[] = [
  "ask",
  "intelligent",
  "full-access",
];

interface BashApprovalModeDropdownProps {
  mode: BashApprovalMode;
  labels: Record<BashApprovalMode, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMode: (mode: BashApprovalMode) => void;
}

export const BashApprovalModeDropdown: React.FC<BashApprovalModeDropdownProps> = ({
  mode,
  labels,
  open,
  onOpenChange,
  onSelectMode,
}) => (
  <DropdownMenu open={open} onOpenChange={onOpenChange}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost2" size="fit">
        {labels[mode]}
        <ChevronDown className="tw-mt-0.5 tw-size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      {BASH_APPROVAL_MODES.map((option) => (
        <DropdownMenuItem key={option} onSelect={() => onSelectMode(option)}>
          {labels[option]}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
