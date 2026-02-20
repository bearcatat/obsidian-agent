import { ModelConfig } from "@/types"
import { MaxOutputTokens } from "../ModelConfigField/MaxOutputTokens"
import { FrequencyPenalty } from "../ModelConfigField/FrequencyPenalty"
import { PresencePenalty } from "../ModelConfigField/PresencePenalty"
import { Temperature } from "../ModelConfigField/Temperature"
import { TopP } from "../ModelConfigField/TopP"
import { WebSearch } from "../ModelConfigField/WebSearch"

const isGemini3Series = (name: string) => {
    return name.startsWith("gemini-3");
}

export const GoogleModelConfig = ({ model, debouncedSetModel }: {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
}) => {
    const isModelGemini3 = isGemini3Series(model.name);

    return (
        <div className="tw-space-y-3">
            <MaxOutputTokens model={model} debouncedSetModel={debouncedSetModel} />
            <Temperature model={model} debouncedSetModel={debouncedSetModel} />
            <TopP model={model} debouncedSetModel={debouncedSetModel} />
            {!isModelGemini3 && (
                <>
                    <FrequencyPenalty model={model} debouncedSetModel={debouncedSetModel} />
                    <PresencePenalty model={model} debouncedSetModel={debouncedSetModel} />
                </>
            )}
            <WebSearch model={model} setModel={debouncedSetModel} />
        </div>
    )
}
