import { ModelConfig, ModelProviders } from "@/types"
import { CommonProviderModelConfig } from "./CommonProviderModelConfig"
import { OpenAIModelConfig } from "./OpenAIModelConfig"
import { MoonshotModelConfig } from "./MoonshotModelConfig"

export const ProviderModelConfig = ({ model, debouncedSetModel }: {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
}) => {
    return (
        <div className="tw-space-y-3">
            {model.provider === ModelProviders.DEEPSEEK && (
                <CommonProviderModelConfig model={model} debouncedSetModel={debouncedSetModel} />
            )}
            {model.provider === ModelProviders.OPENAI && (
                <OpenAIModelConfig model={model} debouncedSetModel={debouncedSetModel} />
            )}
            {model.provider === ModelProviders.ANTHROPIC && (
                <CommonProviderModelConfig model={model} debouncedSetModel={debouncedSetModel} />
            )}
            {model.provider === ModelProviders.OPENAI_FORMAT && (
                <CommonProviderModelConfig model={model} debouncedSetModel={debouncedSetModel} />
            )}
            {model.provider === ModelProviders.MOONSHOT && (
                <MoonshotModelConfig model={model} debouncedSetModel={debouncedSetModel} />
            )}
        </div>
    )
}
