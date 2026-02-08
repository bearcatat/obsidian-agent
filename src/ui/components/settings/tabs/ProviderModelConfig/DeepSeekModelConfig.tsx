import { ModelConfig } from "@/types"
import { MaxOutputTokens } from "../ModelConfigField/MaxOutputTokens"
import { FrequencyPenalty } from "../ModelConfigField/FrequencyPenalty"
import { PresencePenalty } from "../ModelConfigField/PresencePenalty"
import { Temperature } from "../ModelConfigField/Temperature"
import { TopP } from "../ModelConfigField/TopP"

const isDeepSeekChat = (name: string) => {
    return name === "deepseek-chat";
}

const isDeepSeekReasoner = (name: string) => {
    return name === "deepseek-reasoner";
}

export const DeepSeekModelConfig = ({ model, debouncedSetModel }: {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
}) => {
    const isModelDeepSeekChat = isDeepSeekChat(model.name);
    const isModelDeepSeekReasoner = isDeepSeekReasoner(model.name);

    const maxTokens = isModelDeepSeekChat ? 8192 : isModelDeepSeekReasoner ? 65535 : 65000;

    return (
        <div className="tw-space-y-3">
            <MaxOutputTokens
                model={model}
                debouncedSetModel={debouncedSetModel}
                max={maxTokens}
            />
            <Temperature model={model} debouncedSetModel={debouncedSetModel} />
            <TopP model={model} debouncedSetModel={debouncedSetModel} />
            <FrequencyPenalty model={model} debouncedSetModel={debouncedSetModel} />
            <PresencePenalty model={model} debouncedSetModel={debouncedSetModel} />
        </div>
    )
}
