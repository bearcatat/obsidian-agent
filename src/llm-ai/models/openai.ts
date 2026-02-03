import { ModelConfig, ModelProviders } from "@/types";
import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";


export default class OpenAIGenerator {
    private static instance: OpenAIGenerator;

    public provider: string = ModelProviders.OPENAI;

    static getInstance(): OpenAIGenerator {
        if (!OpenAIGenerator.instance) {
            OpenAIGenerator.instance = new OpenAIGenerator();
        }
        return OpenAIGenerator.instance;
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
        const isGPT5Series = modelConfig.name.startsWith("gpt-5");

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
        }
    }
}
