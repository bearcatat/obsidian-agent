import { AIModelGenerator, ModelConfig, ModelProviders, ModelVariant } from "@/types";
import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";


export default class OpenAIGenerator implements AIModelGenerator {
    private static instance: OpenAIGenerator;

    public provider: string = ModelProviders.OPENAI;

    static getInstance(): OpenAIGenerator {
        if (!OpenAIGenerator.instance) {
            OpenAIGenerator.instance = new OpenAIGenerator();
        }
        return OpenAIGenerator.instance;
    }

    private createModel(modelConfig: ModelConfig): LanguageModelV3 {
        const openai = createOpenAI({
            baseURL: modelConfig.baseUrl || "https://api.openai.com/v1",
            apiKey: modelConfig.apiKey
        });

        return openai.chat(modelConfig.name);
    }

    private buildProviderOptions(variant: ModelVariant | undefined, isReasoningModel: boolean): Record<string, any> | undefined {
        if (!isReasoningModel || !variant) {
            return undefined;
        }

        const effortMap: Record<string, string> = {
            low: 'low',
            medium: 'medium',
            high: 'high',
        };
        const reasoningEffort = effortMap[variant];

        if (!reasoningEffort) {
            return undefined;
        }

        return { openai: { reasoningEffort } };
    }

    buildAgentConfig(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        const isOSeries = modelConfig.name.startsWith("o");
        const isGPT5Series = modelConfig.name.startsWith("gpt-5");
        const isReasoningModel = isOSeries || isGPT5Series;
        const providerOptions = this.buildProviderOptions(variant, isReasoningModel);

        return {
            model: this.createModel(modelConfig),
            maxOutputTokens: modelConfig.maxTokens,
            ...(isOSeries || isGPT5Series
                ? {}
                : {
                    temperature: modelConfig.temperature,
                    topP: modelConfig.topP,
                    frequencyPenalty: modelConfig.frequencyPenalty,
                }),
            ...(providerOptions ? { providerOptions } : {}),
        }
    }
}
