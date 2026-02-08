import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { SettingSlider } from "@/ui/elements/setting-slider"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/elements/tooltip"

interface TemperatureProps {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
    defaultValue?: number
    max?: number
    min?: number
    step?: number
}

export const Temperature = ({
    model,
    debouncedSetModel,
    defaultValue = 0.1,
    max = 2,
    min = 0,
    step = 0.05,
}: TemperatureProps) => {
    return (<FormField
        label={
            <div className="tw-flex tw-items-center tw-gap-2">
                Temperature
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <HelpCircle className="tw-size-4 tw-text-muted" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <div className="tw-max-w-[300px]">
                                Default is {defaultValue}. Higher values will result
                                in more creativeness, but also more mistakes. Set to 0 for no randomness.
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        }
    >
        <SettingSlider
            value={model.temperature ?? defaultValue}
            onChange={(value) => debouncedSetModel({ ...model, temperature: value })}
            max={max}
            min={min}
            step={step}
        />
    </FormField>)

}
