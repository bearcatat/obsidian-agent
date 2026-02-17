import { ModelConfig, ModelProviders } from "@/types"
import { CommonProviderModelConfig } from "./CommonProviderModelConfig"
import { OpenAIModelConfig } from "./OpenAIModelConfig"
import { MoonshotModelConfig } from "./MoonshotModelConfig"
import { GoogleModelConfig } from "./GoogleModelConfig"
import { DeepSeekModelConfig } from "./DeepSeekModelConfig"

export const ProviderModelConfig = ({ model, debouncedSetModel, setModel }: {
    model: ModelConfig
    debouncedSetModel: (model: ModelConfig) => void
    setModel: (model: ModelConfig) => void
}) => {
    return (
        <div className="tw-space-y-3">
            {model.provider === ModelProviders.DEEPSEEK && (
                <DeepSeekModelConfig model={model} debouncedSetModel={debouncedSetModel} />
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
                <MoonshotModelConfig model={model} debouncedSetModel={debouncedSetModel} setModel={setModel} />
            )}
            {model.provider === ModelProviders.GOOGLE && (
                <GoogleModelConfig model={model} debouncedSetModel={debouncedSetModel} />
            )}
        </div>
    )
}
