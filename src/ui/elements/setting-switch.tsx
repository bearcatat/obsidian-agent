import * as React from "react";
import { cn } from "./utils";

interface SettingSwitchProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

const SettingSwitch = React.forwardRef<HTMLDivElement, SettingSwitchProps>(
  ({ checked = false, onCheckedChange, disabled = false, className, ...props }, ref) => {
    const handleClick = () => {
      if (!disabled) {
        onCheckedChange?.(!checked);
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (disabled) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onCheckedChange?.(!checked);
      }
    };

    return (
      <div
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        data-state={checked ? "checked" : "unchecked"}
        data-disabled={disabled ? "" : undefined}
        ref={ref}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "tw-relative tw-box-border tw-inline-flex tw-h-[22px] tw-w-[40px] tw-shrink-0 tw-cursor-pointer tw-items-center tw-overflow-hidden tw-rounded-full tw-p-[3px] tw-transition-colors",
          "focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring focus-visible:tw-ring-offset-2",
          checked ? "tw-bg-interactive-accent" : "tw-bg-[--background-modifier-border-hover]",
          disabled && "tw-cursor-not-allowed tw-opacity-50",
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        <div
          className={cn(
            "tw-pointer-events-none tw-block tw-size-[16px] tw-shrink-0 tw-rounded-full tw-bg-toggle-thumb tw-shadow-lg tw-ring-0 tw-transition-transform",
            checked ? "tw-translate-x-[18px]" : "tw-translate-x-0"
          )}
        />
      </div>
    );
  }
);

SettingSwitch.displayName = "SettingSwitch";

export { SettingSwitch };
