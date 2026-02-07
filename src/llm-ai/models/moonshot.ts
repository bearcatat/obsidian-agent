import { ModelConfig, ModelProviders } from "@/types";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";


export default class MoonshotGenerator {
    private static instance: MoonshotGenerator;

    public provider: string = ModelProviders.MOONSHOT;

    static getInstance(): MoonshotGenerator {
        if (!MoonshotGenerator.instance) {
            MoonshotGenerator.instance = new MoonshotGenerator();
        }
        return MoonshotGenerator.instance;
    }

    createModel(modelConfig: ModelConfig): LanguageModelV3 {
        if (!modelConfig.baseUrl){
            throw("empty base url")
        }
        const openai = createOpenAICompatible({
            baseURL: modelConfig.baseUrl,
            apiKey: modelConfig.apiKey,
            name: "moonshot"
        });

        return openai.chatModel(modelConfig.name);
    }

    newAgent(modelConfig: ModelConfig): ToolLoopAgentSettings {
        // Force topP to 0.95 for kimi-k2.5 model
        const topP = modelConfig.name === 'kimi-k2.5' ? 0.95 : modelConfig.topP;
        
        return {
            model: this.createModel(modelConfig),
            temperature: modelConfig.temperature,
            maxOutputTokens: modelConfig.maxTokens,
            topP: topP,
            frequencyPenalty: modelConfig.frequencyPenalty,
        }
    }
}
