import { ModelConfig, ModelProviderStrategy, ModelProviders } from "@/types";
import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";


export default class OpenAIFormatProviderStrategy implements ModelProviderStrategy {
    readonly provider = ModelProviders.OPENAI_FORMAT;

    private createModel(modelConfig: ModelConfig): LanguageModelV3 {
        const openai = createOpenAI({
            baseURL: modelConfig.baseUrl || "https://api.openai.com/v1",
            apiKey: modelConfig.apiKey
        });

        return openai.chat(modelConfig.name);
    }

    buildAgentConfig(modelConfig: ModelConfig): ToolLoopAgentSettings {
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
