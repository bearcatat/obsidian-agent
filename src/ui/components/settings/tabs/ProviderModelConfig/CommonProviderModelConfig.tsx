import { ModelConfig } from "@/types"
import { MaxOutputTokens } from "../ModelConfigField/MaxOutputTokens"
import { FrequencyPenalty } from "../ModelConfigField/FrequencyPenalty"
import { PresencePenalty } from "../ModelConfigField/PresencePenalty"
import { Temperature } from "../ModelConfigField/Temperature"
import { TopP } from "../ModelConfigField/TopP"

export const CommonProviderModelConfig = ({ model, debouncedSetModel }: {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
}) => {
    return (
        <div className="tw-space-y-3">
            <MaxOutputTokens model={model} debouncedSetModel={debouncedSetModel} />
            <Temperature model={model} debouncedSetModel={debouncedSetModel} />
            <TopP model={model} debouncedSetModel={debouncedSetModel} />
            <FrequencyPenalty model={model} debouncedSetModel={debouncedSetModel} />
            <PresencePenalty model={model} debouncedSetModel={debouncedSetModel} />
        </div>
    )
}
