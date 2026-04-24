import { ModelConfig, ModelProviders, ModelVariant } from "@/types";
import { createDeepSeek, } from '@ai-sdk/deepseek';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";



export default class DeepSeekGenerator {
    private static instance: DeepSeekGenerator;

    public provider: string = ModelProviders.DEEPSEEK;

    static getInstance(): DeepSeekGenerator {
        if (!DeepSeekGenerator.instance) {
            DeepSeekGenerator.instance = new DeepSeekGenerator();
        }
        return DeepSeekGenerator.instance;
    }

    createModel(modelConfig: ModelConfig): LanguageModelV3 {
        return createDeepSeek(
            {
                baseURL: modelConfig.baseUrl || "https://api.deepseek.com/v1",
                apiKey: modelConfig.apiKey
            }
        ).chat(modelConfig.name)
    }

    newAgent(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        const isThinkingModel = modelConfig.name.includes('v4-pro') || modelConfig.name.includes('v4-flash');

        let providerOptions: Record<string, any> | undefined;
        if (isThinkingModel && variant) {
            if (variant === 'off') {
                providerOptions = { deepseek: { thinking: { type: 'disabled' } } };
            } else if (variant === 'high') {
                providerOptions = { deepseek: { thinking: { type: 'enabled' } } };
            } else if (variant === 'max') {
                providerOptions = { deepseek: { thinking: { type: 'enabled' }, reasoning_effort: 'max' } };
            }
        }

        return {
            model: this.createModel(modelConfig),
            temperature: modelConfig.temperature,
            maxOutputTokens: modelConfig.maxTokens,
            topP: modelConfig.topP,
            frequencyPenalty: modelConfig.frequencyPenalty,
            presencePenalty: modelConfig.presencePenalty,
            ...(providerOptions ? { providerOptions } : {}),
        }
    }
}