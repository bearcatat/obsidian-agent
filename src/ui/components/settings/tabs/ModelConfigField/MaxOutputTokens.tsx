import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { SettingSlider } from "@/ui/elements/setting-slider"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/elements/tooltip"

interface MaxOutputTokensProps {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
    defaultValue?: number
    max?: number
    min?: number
    step?: number
}

export const MaxOutputTokens = ({
    model,
    debouncedSetModel,
    defaultValue = 8192,
    max = 65000,
    min = 0,
    step = 100,
}: MaxOutputTokensProps) => {
    return (<FormField
        label={
            <div className="tw-flex tw-items-center tw-gap-2">
                Max Output Tokens
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <HelpCircle className="tw-size-4 tw-text-muted" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <div className="tw-w-[300px]">
                                <p>
                                    The maximum number of <em>output tokens</em> to generate. Default is{" "}
                                    {defaultValue}.
                                </p>
                                <em>
                                    This number plus the length of your prompt (input tokens) must be
                                    smaller than the context window of the model.
                                </em>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        }
    >
        <SettingSlider
            value={model.maxTokens ?? defaultValue}
            onChange={(value) => debouncedSetModel({ ...model, maxTokens: value })}
            min={min}
            max={max}
            step={step}
        />
    </FormField>)

}
