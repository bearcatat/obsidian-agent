import { ModelConfig } from "@/types";
import { createDeepSeek, } from '@ai-sdk/deepseek';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { generateText, GenerateTextOnFinishCallback, ModelMessage, ToolSet, AssistantModelMessage, ToolModelMessage, ToolLoopAgent } from "ai";



export default class DeepSeekGenerator {
    private static instance: DeepSeekGenerator;

    static getInstance(): DeepSeekGenerator {
        if (!DeepSeekGenerator.instance) {
            DeepSeekGenerator.instance = new DeepSeekGenerator();
        }
        return DeepSeekGenerator.instance;
    }

    newModel(modelConfig: ModelConfig): DeepSeekModel {
        return new DeepSeekModel(modelConfig)
    }
}

class DeepSeekModel {
    private modelConfig: ModelConfig
    private model: LanguageModelV3
    private agent: ToolLoopAgent

    constructor(modelConfig: ModelConfig) {
        this.modelConfig = modelConfig
        this.model = createDeepSeek(
            {
                baseURL: modelConfig.baseUrl || "https://api.deepseek.com/v1",
                apiKey: modelConfig.apiKey
            }
        ).chat(this.modelConfig.name)
        this.agent
    }

    async generateText(messages: Array<ModelMessage>, tools: ToolSet, abortController: AbortController, onFinish: GenerateTextOnFinishCallback<ToolSet>): Promise<string> {
        const { text } = await generateText({
            model: this.model,
            messages: messages,
            toolChoice: "auto",
            tools: tools,
            abortSignal: abortController.signal,
            maxRetries: 3,
            maxOutputTokens: this.modelConfig.maxTokens,
            temperature: this.modelConfig.temperature,
            topP: this.modelConfig.topP,
            frequencyPenalty: this.modelConfig.frequencyPenalty,
            onFinish: onFinish,
        })
        return text
    }

    getModel(): LanguageModelV3 {
        return this.model
    }
}