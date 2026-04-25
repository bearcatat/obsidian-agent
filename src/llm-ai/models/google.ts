import { AIModelGenerator, ModelConfig, ModelProviders, ModelVariant } from "@/types";
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";


export default class GoogleGenerator implements AIModelGenerator {
    private static instance: GoogleGenerator;

    public provider: string = ModelProviders.GOOGLE;

    static getInstance(): GoogleGenerator {
        if (!GoogleGenerator.instance) {
            GoogleGenerator.instance = new GoogleGenerator();
        }
        return GoogleGenerator.instance;
    }

    private createModel(modelConfig: ModelConfig): LanguageModelV3 {
        const google = createGoogleGenerativeAI({
            baseURL: modelConfig.baseUrl || `https://generativelanguage.googleapis.com/v1beta`,
            apiKey: modelConfig.apiKey
        });

        return google.chat(modelConfig.name);
    }

    private buildProviderOptions(
        variant: ModelVariant | undefined,
        isGemini3Series: boolean,
        isGemini25Series: boolean,
    ): Record<string, any> | undefined {
        if (!variant || variant === 'off') {
            return undefined;
        }

        if (isGemini3Series) {
            const levelMap: Record<string, string> = {
                low: 'low',
                medium: 'medium',
                high: 'high',
            };
            const thinkingLevel = levelMap[variant] ?? 'medium';
            return { google: { thinkingConfig: { thinkingLevel, includeThoughts: true } } };
        }

        if (isGemini25Series) {
            const budgetMap: Record<string, number> = {
                low: 1024,
                medium: 8192,
                high: 16384,
            };
            const thinkingBudget = budgetMap[variant] ?? 1024;
            return { google: { thinkingConfig: { thinkingBudget, includeThoughts: true } } };
        }

        return undefined;
    }

    buildAgentConfig(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        const isGemini3Series = modelConfig.name.startsWith("gemini-3");
        const isGemini25Series = modelConfig.name.includes("gemini-2.5");
        const providerOptions = this.buildProviderOptions(variant, isGemini3Series, isGemini25Series);

        return {
            model: this.createModel(modelConfig),
            maxOutputTokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature,
            topP: modelConfig.topP,
            ...(isGemini3Series
                ? {}
                : {
                    frequencyPenalty: modelConfig.frequencyPenalty,
                    presencePenalty: modelConfig.presencePenalty,
                }),
            ...(providerOptions ? { providerOptions } : {}),
        }
    }
}
