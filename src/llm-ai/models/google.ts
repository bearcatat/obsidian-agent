import { ModelConfig, ModelProviders } from "@/types";
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings, ToolSet } from "ai";


export default class GoogleGenerator {
    private static instance: GoogleGenerator;

    public provider: string = ModelProviders.GOOGLE;

    static getInstance(): GoogleGenerator {
        if (!GoogleGenerator.instance) {
            GoogleGenerator.instance = new GoogleGenerator();
        }
        return GoogleGenerator.instance;
    }

    createModel(modelConfig: ModelConfig): LanguageModelV3 {
        const google = createGoogleGenerativeAI({
            baseURL: modelConfig.baseUrl || `https://generativelanguage.googleapis.com/v1beta`,
            apiKey: modelConfig.apiKey
        });

        return google.chat(modelConfig.name);
    }

    private getBuiltinTools(modelConfig: ModelConfig): ToolSet | undefined {
        if (!modelConfig.webSearchEnabled) {
            return undefined;
        }

        const google = createGoogleGenerativeAI({
            baseURL: modelConfig.baseUrl || `https://generativelanguage.googleapis.com/v1beta`,
            apiKey: modelConfig.apiKey
        });

        return {
            google_search: google.tools.googleSearch({
                mode: 'MODE_DYNAMIC',
                dynamicThreshold: 0.7
            })
        };
    }

    newAgent(modelConfig: ModelConfig): ToolLoopAgentSettings {
        const isGemini3Series = modelConfig.name.startsWith("gemini-3");

        return {
            model: this.createModel(modelConfig),
            tools: this.getBuiltinTools(modelConfig),
            maxOutputTokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature,
            topP: modelConfig.topP,
            ...(isGemini3Series
                ? {}
                : {
                    frequencyPenalty: modelConfig.frequencyPenalty,
                    presencePenalty: modelConfig.presencePenalty,
                }),
        }
    }
}
