import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { SettingSlider } from "@/ui/elements/setting-slider"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/elements/tooltip"
import { formatNumber, t } from "@/i18n"

interface TopPProps {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
    defaultValue?: number
    max?: number
    min?: number
    step?: number
}

export const TopP = ({
    model,
    debouncedSetModel,
    defaultValue = 0.3,
    max = 1,
    min = 0,
    step = 0.05,
}: TopPProps) => {
    return (<FormField
        label={
            <div className="tw-flex tw-items-center tw-gap-2">
                {t("settings:topP")}
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <HelpCircle className="tw-size-4 tw-text-muted" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <div className="tw-w-[300px]">
                                {t("settings:topPHelp", { defaultValue: formatNumber(defaultValue) })}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        }
    >
        <SettingSlider
            value={model.topP ?? defaultValue}
            onChange={(value) => debouncedSetModel({ ...model, topP: value })}
            max={max}
            min={min}
            step={step}
        />
    </FormField>)

}
