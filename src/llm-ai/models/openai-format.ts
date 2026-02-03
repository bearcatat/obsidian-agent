import { ModelConfig, ModelProviders } from "@/types";
import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";


export default class OpenAIFormatGenerator {
    private static instance: OpenAIFormatGenerator;

    public provider: string = ModelProviders.OPENAI_FORMAT;

    static getInstance(): OpenAIFormatGenerator {
        if (!OpenAIFormatGenerator.instance) {
            OpenAIFormatGenerator.instance = new OpenAIFormatGenerator();
        }
        return OpenAIFormatGenerator.instance;
    }

    createModel(modelConfig: ModelConfig): LanguageModelV3 {
        const openai = createOpenAI({
            baseURL: modelConfig.baseUrl || "https://api.openai.com/v1",
            apiKey: modelConfig.apiKey
        });

        return openai.chat(modelConfig.name);
    }

    newAgent(modelConfig: ModelConfig): ToolLoopAgentSettings {
        const isOSeries = modelConfig.name.startsWith("o");

        return {
            model: this.createModel(modelConfig),
            maxOutputTokens: modelConfig.maxTokens,
            ...(isOSeries
                ? {}
                : {
                    temperature: modelConfig.temperature,
                    topP: modelConfig.topP,
                    frequencyPenalty: modelConfig.frequencyPenalty,
                }),
        }
    }
}
