import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { SettingSlider } from "@/ui/elements/setting-slider"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/elements/tooltip"
import { formatNumber, t } from "@/i18n"

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
                {t("settings:presencePenalty")}
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <HelpCircle className="tw-size-4 tw-text-muted" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <div className="tw-w-[300px]">
                                {t("settings:presencePenaltyHelp", {
                                    min: formatNumber(min),
                                    max: formatNumber(max),
                                    defaultValue: formatNumber(defaultValue),
                                })}
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
