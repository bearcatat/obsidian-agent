import { ModelConfig, ModelProviders } from "@/types";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";
import { createOpenAICORSPseudoStreamFetchAdapter } from "../utils/cors-fetch";


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
        // 根据配置决定是否使用 CORS 代理，使用伪流式适配器
        const customFetch = modelConfig.useCORS ? createOpenAICORSPseudoStreamFetchAdapter() : undefined;

        const openai = createOpenAICompatible({
            baseURL: modelConfig.baseUrl || "https://api.moonshot.cn/v1",
            apiKey: modelConfig.apiKey,
            name: "moonshot",
            fetch: customFetch,
        });

        return openai.chatModel(modelConfig.name);
    }

    newAgent(modelConfig: ModelConfig): ToolLoopAgentSettings {
        // Force topP to 0.95 and frequencyPenalty to 0 for kimi-k2.5 model
        const isKimiK25 = modelConfig.name === 'kimi-k2.5';
        const topP = isKimiK25 ? 0.95 : modelConfig.topP;
        const frequencyPenalty = isKimiK25 ? 0 : modelConfig.frequencyPenalty;
        const temperature = isKimiK25 ? 1 : modelConfig.temperature;

        return {
            model: this.createModel(modelConfig),
            temperature: temperature,
            maxOutputTokens: modelConfig.maxTokens,
            topP: topP,
            frequencyPenalty: frequencyPenalty,
        }
    }
}
