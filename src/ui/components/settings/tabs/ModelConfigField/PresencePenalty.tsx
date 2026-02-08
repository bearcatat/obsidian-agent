import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { SettingSlider } from "@/ui/elements/setting-slider"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/elements/tooltip"

interface PresencePenaltyProps {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
    defaultValue?: number
    max?: number
    min?: number
    step?: number
}

export const PresencePenalty = ({
    model,
    debouncedSetModel,
    defaultValue = 0,
    max = 2,
    min = -2,
    step = 0.05,
}: PresencePenaltyProps) => {
    return (<FormField
        label={
            <div className="tw-flex tw-items-center tw-gap-2">
                Presence Penalty
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <HelpCircle className="tw-size-4 tw-text-muted" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <div className="tw-w-[300px]">
                                <p>
                                    If positive, penalizes new tokens based on whether they appear in the text so far,
                                    increasing the model&apos;s likelihood to talk about new topics.
                                </p>
                                <em>
                                    Range: {min} to {max}, default: {defaultValue}
                                </em>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        }
    >
        <SettingSlider
            value={model.presencePenalty ?? defaultValue}
            onChange={(value) => debouncedSetModel({ ...model, presencePenalty: value })}
            max={max}
            min={min}
            step={step}
        />
    </FormField>)

}
