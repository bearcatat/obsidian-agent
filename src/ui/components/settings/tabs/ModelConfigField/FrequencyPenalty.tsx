import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { SettingSlider } from "@/ui/elements/setting-slider"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/elements/tooltip"

interface FrequencyPenaltyProps {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
    label?: string
    defaultValue?: number
    max?: number
    min?: number
    step?: number
}

export const FrequencyPenalty = ({
    model,
    debouncedSetModel,
    defaultValue = 0,
    max = 2,
    min = -2,
    step = 0.05,
}: FrequencyPenaltyProps) => {
    return (<FormField
        label={
            <div className="tw-flex tw-items-center tw-gap-2">
                Frequency Penalty
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <HelpCircle className="tw-size-4 tw-text-muted" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <div className="tw-w-[300px]">
                                <p>
                                    The frequency penalty parameter tells the model not to repeat a word
                                    that has already been used multiple times in the conversation.
                                </p>
                                <em>
                                    The higher the value, the more the model is penalized for repeating
                                    words.
                                </em>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        }
    >
        <SettingSlider
            value={model.frequencyPenalty ?? defaultValue}
            onChange={(value) => debouncedSetModel({ ...model, frequencyPenalty: value })}
            max={max}
            min={min}
            step={step}
        />
    </FormField>)

}
