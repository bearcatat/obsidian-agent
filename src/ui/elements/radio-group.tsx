import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/ui/elements/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("tw-grid tw-gap-2", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        // 基础结构
        "tw-peer tw-aspect-square tw-size-4 tw-rounded-full tw-border tw-border-interactive-accent tw-shrink-0",

        // 基础视觉
        "!tw-bg-transparent tw-p-0 !tw-shadow tw-transition-colors",

        // hover = checkbox 行为
        "hover:!tw-bg-interactive-accent hover:!tw-text-on-accent",

        // checked = checkbox 行为
        "data-[state=checked]:!tw-bg-interactive-accent data-[state=checked]:!tw-text-on-accent",

        // focus / a11y
        "focus-visible:tw-outline-none focus-visible:tw-ring-1 focus-visible:tw-ring-ring",

        // disabled
        "disabled:tw-cursor-default disabled:tw-opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="tw-flex tw-items-center tw-justify-center">
        <Circle className="tw-h-3.5 tw-w-3.5 tw-fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }
