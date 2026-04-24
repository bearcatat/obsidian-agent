import { ModelConfig, ModelProviders, ModelVariant } from "@/types";
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";


export default class AnthropicGenerator {
    private static instance: AnthropicGenerator;

    public provider: string = ModelProviders.ANTHROPIC;

    static getInstance(): AnthropicGenerator {
        if (!AnthropicGenerator.instance) {
            AnthropicGenerator.instance = new AnthropicGenerator();
        }
        return AnthropicGenerator.instance;
    }

    createModel(modelConfig: ModelConfig): LanguageModelV3 {
        return createAnthropic(
            {
                baseURL: modelConfig.baseUrl || "https://api.anthropic.com/v1",
                apiKey: modelConfig.apiKey
            }
        ).chat(modelConfig.name)
    }

    newAgent(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        let providerOptions: Record<string, any> | undefined;
        if (variant && variant !== 'off') {
            const supportsAdaptive =
                modelConfig.name.includes('claude-opus-4-6') ||
                modelConfig.name.includes('claude-opus-4-7') ||
                modelConfig.name.includes('claude-sonnet-4-6');

            if (supportsAdaptive) {
                providerOptions = {
                    anthropic: {
                        thinking: { type: 'adaptive' },
                        effort: variant,
                    }
                };
            } else {
                // claude-3-7, claude-opus-4-5, claude-sonnet-4-5 etc: use enabled + budgetTokens
                const budgetMap: Record<string, number> = {
                    low: 2048,
                    medium: 8192,
                    high: 16000,
                    max: 32000,
                };
                const budgetTokens = budgetMap[variant] ?? 8192;
                providerOptions = {
                    anthropic: {
                        thinking: { type: 'enabled', budgetTokens },
                    }
                };
            }
        }

        return {
            model: this.createModel(modelConfig),
            temperature: modelConfig.temperature,
            maxOutputTokens: modelConfig.maxTokens,
            topP: modelConfig.topP,
            frequencyPenalty: modelConfig.frequencyPenalty,
            ...(providerOptions ? { providerOptions } : {}),
        }
    }
}
