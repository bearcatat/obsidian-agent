import { AIModelGenerator, ModelConfig, ModelProviders, ModelVariant } from "@/types";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ToolLoopAgentSettings } from "ai";
import { createOpenAICORSPseudoStreamFetchAdapter } from "../utils/cors-fetch";


export default class MoonshotGenerator implements AIModelGenerator {
    private static instance: MoonshotGenerator;

    public provider: string = ModelProviders.MOONSHOT;

    static getInstance(): MoonshotGenerator {
        if (!MoonshotGenerator.instance) {
            MoonshotGenerator.instance = new MoonshotGenerator();
        }
        return MoonshotGenerator.instance;
    }

    private createModel(modelConfig: ModelConfig): LanguageModelV3 {
        // 根据配置决定是否使用 CORS 代理，使用伪流式适配器
        const customFetch = modelConfig.useCORS ? createOpenAICORSPseudoStreamFetchAdapter() : undefined;

        const moonshotai = createMoonshotAI({
            baseURL: modelConfig.baseUrl || "https://api.moonshot.cn/v1",
            apiKey: modelConfig.apiKey,
            fetch: customFetch,
        });

        return moonshotai.chatModel(modelConfig.name);
    }

    private resolveTemperature(modelConfig: ModelConfig, variant: ModelVariant | undefined, isKimiK25OrK26: boolean): number | undefined {
        if (!isKimiK25OrK26) {
            return modelConfig.temperature;
        }

        return variant === 'off' ? 0.6 : 1;
    }

    private buildProviderOptions(variant: ModelVariant | undefined, isKimiK25OrK26: boolean): Record<string, any> | undefined {
        if (!isKimiK25OrK26) {
            return undefined;
        }

        if (variant && variant !== 'off') {
            return {
                moonshotai: {
                    thinking: { type: 'enabled' },
                    reasoningHistory: 'interleaved',
                }
            };
        }

        if (variant === 'off') {
            return {
                moonshotai: {
                    thinking: { type: 'disabled' },
                }
            };
        }

        return undefined;
    }

    buildAgentConfig(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        // Force parameters for kimi-k2.5/kimi-k2.6
        const isKimiK25OrK26 = modelConfig.name.includes('kimi-k2.5') || modelConfig.name.includes('kimi-k2.6');
        const topP = isKimiK25OrK26 ? 0.95 : modelConfig.topP;
        const frequencyPenalty = isKimiK25OrK26 ? 0 : modelConfig.frequencyPenalty;
        // API requires temperature=1.0 for thinking mode, temperature=0.6 for non-thinking mode
        const temperature = this.resolveTemperature(modelConfig, variant, isKimiK25OrK26);
        const providerOptions = this.buildProviderOptions(variant, isKimiK25OrK26);

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
