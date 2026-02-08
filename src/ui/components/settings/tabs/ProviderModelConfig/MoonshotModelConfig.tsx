import { ModelConfig } from "@/types"
import { MaxOutputTokens } from "../ModelConfigField/MaxOutputTokens"
import { FrequencyPenalty } from "../ModelConfigField/FrequencyPenalty"
import { Temperature } from "../ModelConfigField/Temperature"
import { TopP } from "../ModelConfigField/TopP"

const isKimiK25 = (name: string) => {
    return name === 'kimi-k2.5';
}

export const MoonshotModelConfig = ({ model, debouncedSetModel }: {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
}) => {
    const isModelKimiK25 = isKimiK25(model.name);

    return (
        <div className="tw-space-y-3">
            {!isModelKimiK25 && (
                <>
                    <Temperature model={model} debouncedSetModel={debouncedSetModel} />
                    <TopP model={model} debouncedSetModel={debouncedSetModel} />
                    <FrequencyPenalty model={model} debouncedSetModel={debouncedSetModel} />
                </>
            )}
        </div>
    )
}
