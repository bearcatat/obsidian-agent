import { ModelConfig } from "@/types"
import { MaxOutputTokens } from "../ModelConfigField/MaxOutputTokens"
import { FrequencyPenalty } from "../ModelConfigField/FrequencyPenalty"
import { Temperature } from "../ModelConfigField/Temperature"
import { TopP } from "../ModelConfigField/TopP"
import { UseCORS } from "../ModelConfigField/UseCORS"

const isKimiK25 = (name: string) => {
    return name === 'kimi-k2.5';
}

export const MoonshotModelConfig = ({ model, debouncedSetModel, setModel }: {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
    setModel: (model: ModelConfig) => void
}) => {
    const isModelKimiK25 = isKimiK25(model.name);
    const maxTokens = 32768

    return (
        <div className="tw-space-y-3">
            <UseCORS model={model} setModel={setModel} />
            <MaxOutputTokens
                model={model}
                debouncedSetModel={debouncedSetModel}
                max={maxTokens}
            />
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
