import { ModelConfig, ModelProviders } from "@/types";
import { createDeepSeek, } from '@ai-sdk/deepseek';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { generateText, GenerateTextOnFinishCallback, ModelMessage, ToolSet, AssistantModelMessage, ToolModelMessage, ToolLoopAgent, ToolLoopAgentSettings } from "ai";



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

    newAgent(modelConfig: ModelConfig): ToolLoopAgentSettings {
        return {
            model: this.createModel(modelConfig),
            temperature: modelConfig.temperature,
            maxOutputTokens: modelConfig.maxTokens,
            topP: modelConfig.topP,
            frequencyPenalty: modelConfig.frequencyPenalty,
            presencePenalty: modelConfig.presencePenalty,
        }
    }
}