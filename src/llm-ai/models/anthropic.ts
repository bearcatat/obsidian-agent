import { AIModelGenerator, ModelConfig, ModelProviders, ModelVariant } from "@/types";
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";


export default class AnthropicGenerator implements AIModelGenerator {
    private static instance: AnthropicGenerator;

    public provider: string = ModelProviders.ANTHROPIC;

    static getInstance(): AnthropicGenerator {
        if (!AnthropicGenerator.instance) {
            AnthropicGenerator.instance = new AnthropicGenerator();
        }
        return AnthropicGenerator.instance;
    }

    private createModel(modelConfig: ModelConfig): LanguageModelV3 {
        return createAnthropic(
            {
                baseURL: modelConfig.baseUrl || "https://api.anthropic.com/v1",
                apiKey: modelConfig.apiKey
            }
        ).chat(modelConfig.name)
    }

    private buildProviderOptions(modelConfig: ModelConfig, variant?: ModelVariant): Record<string, any> | undefined {
        if (!variant || variant === 'off') {
            return undefined;
        }

        const supportsAdaptive =
            modelConfig.name.includes('claude-opus-4-6') ||
            modelConfig.name.includes('claude-opus-4-7') ||
            modelConfig.name.includes('claude-sonnet-4-6');

        if (supportsAdaptive) {
            return {
                anthropic: {
                    thinking: { type: 'adaptive' },
                    effort: variant,
                }
            };
        }

        const budgetMap: Record<string, number> = {
            low: 2048,
            medium: 8192,
            high: 16000,
            max: 32000,
        };
        const budgetTokens = budgetMap[variant] ?? 8192;

        return {
            anthropic: {
                thinking: { type: 'enabled', budgetTokens },
            }
        };
    }

    buildAgentConfig(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        const providerOptions = this.buildProviderOptions(modelConfig, variant);

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
