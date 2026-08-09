import React from "react";
import { ChevronDown } from "lucide-react";
import { Button, type ButtonProps } from "@/ui/elements/button";
import { cn } from "@/ui/elements/utils";

export const SettingDropdownTrigger = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, ...props }, ref) => (
    <Button
      ref={ref}
      variant="secondary"
      className={cn("tw-w-64 tw-max-w-full tw-min-w-0 tw-justify-between", className)}
      {...props}
    >
      <span className="tw-truncate">{children}</span>
      <ChevronDown className="tw-size-4 tw-shrink-0" />
    </Button>
  ),
);

SettingDropdownTrigger.displayName = "SettingDropdownTrigger";
