import { ModelConfig, ModelProviders } from "@/types";
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

    newAgent(modelConfig: ModelConfig): ToolLoopAgentSettings {
        return {
            model: this.createModel(modelConfig),
            temperature: modelConfig.temperature,
            maxOutputTokens: modelConfig.maxTokens,
            topP: modelConfig.topP,
            frequencyPenalty: modelConfig.frequencyPenalty,
        }
    }
}
