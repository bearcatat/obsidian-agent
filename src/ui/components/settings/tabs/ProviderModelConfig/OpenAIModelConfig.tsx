import { ModelConfig } from "@/types"
import { MaxOutputTokens } from "../ModelConfigField/MaxOutputTokens"
import { FrequencyPenalty } from "../ModelConfigField/FrequencyPenalty"
import { Temperature } from "../ModelConfigField/Temperature"
import { TopP } from "../ModelConfigField/TopP"

const isOSeriesOrGPT5 = (name: string) => {
    return name.startsWith("o") || name.startsWith("gpt-5");
}

export const OpenAIModelConfig = ({ model, debouncedSetModel }: {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
}) => {
    const showAdvancedParams = !isOSeriesOrGPT5(model.name);

    return (
        <div className="tw-space-y-3">
            <MaxOutputTokens model={model} debouncedSetModel={debouncedSetModel} />
            {showAdvancedParams && (
                <>
                    <Temperature model={model} debouncedSetModel={debouncedSetModel} />
                    <TopP model={model} debouncedSetModel={debouncedSetModel} />
                    <FrequencyPenalty model={model} debouncedSetModel={debouncedSetModel} />
                </>
            )}
        </div>
    )
}
