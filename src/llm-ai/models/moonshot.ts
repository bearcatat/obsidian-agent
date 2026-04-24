import { ModelConfig, ModelProviders, ModelVariant } from "@/types";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
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

        const moonshotai = createMoonshotAI({
            baseURL: modelConfig.baseUrl || "https://api.moonshot.cn/v1",
            apiKey: modelConfig.apiKey,
            fetch: customFetch,
        });

        return moonshotai.chatModel(modelConfig.name);
    }

    newAgent(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        // Force parameters for kimi-k2.5/kimi-k2.6
        const isKimiK25OrK26 = modelConfig.name.includes('kimi-k2.5') || modelConfig.name.includes('kimi-k2.6');
        const topP = isKimiK25OrK26 ? 0.95 : modelConfig.topP;
        const frequencyPenalty = isKimiK25OrK26 ? 0 : modelConfig.frequencyPenalty;
        // API requires temperature=1.0 for thinking mode, temperature=0.6 for non-thinking mode
        const temperature = isKimiK25OrK26
            ? (variant === 'off' ? 0.6 : 1)
            : modelConfig.temperature;

        let providerOptions: Record<string, any> | undefined;
        if (isKimiK25OrK26) {
            if (variant && variant !== 'off') {
                providerOptions = {
                    moonshotai: {
                        thinking: { type: 'enabled' },
                        reasoningHistory: 'interleaved',
                    }
                };
            } else if (variant === 'off') {
                providerOptions = {
                    moonshotai: {
                        thinking: { type: 'disabled' },
                    }
                };
            }
        }

        return {
            model: this.createModel(modelConfig),
            temperature: temperature,
            maxOutputTokens: modelConfig.maxTokens,
            topP: topP,
            frequencyPenalty: frequencyPenalty,
            ...(providerOptions ? { providerOptions } : {}),
        }
    }
}
