import { AIModelGenerator, ModelConfig, ModelProviders, ModelVariant } from "@/types";
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { LanguageModelV3 } from "@ai-sdk/provider";
import { ModelMessage, ToolLoopAgentSettings } from "ai";



export default class DeepSeekGenerator implements AIModelGenerator {
    private static instance: DeepSeekGenerator;

    public provider: string = ModelProviders.DEEPSEEK;

    static getInstance(): DeepSeekGenerator {
        if (!DeepSeekGenerator.instance) {
            DeepSeekGenerator.instance = new DeepSeekGenerator();
        }
        return DeepSeekGenerator.instance;
    }

    private createModel(modelConfig: ModelConfig): LanguageModelV3 {
        return createOpenAICompatible({
            name: 'deepseek',
            baseURL: modelConfig.baseUrl || "https://api.deepseek.com/v1",
            apiKey: modelConfig.apiKey,
        }).chatModel(modelConfig.name)
    }

    private isThinkingModel(modelConfig: ModelConfig): boolean {
        return modelConfig.name.includes('v4-pro') || modelConfig.name.includes('v4-flash')
    }

    private buildProviderOptions(variant: ModelVariant | undefined, isThinkingModel: boolean): Record<string, any> | undefined {
        if (!isThinkingModel || !variant) {
            return undefined;
        }

        if (variant === 'off') {
            return { deepseek: { thinking: { type: 'disabled' } } };
        }

        if (variant === 'high') {
            return { deepseek: { thinking: { type: 'enabled' } } };
        }

        if (variant === 'max') {
            return { deepseek: { thinking: { type: 'enabled' }, reasoningEffort: 'max' } };
        }

        return undefined;
    }

    buildAgentConfig(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        const isThinkingModel = this.isThinkingModel(modelConfig);
        const providerOptions = this.buildProviderOptions(variant, isThinkingModel);

        return {
            model: this.createModel(modelConfig),
            temperature: modelConfig.temperature,
            maxOutputTokens: modelConfig.maxTokens,
            topP: modelConfig.topP,
            frequencyPenalty: modelConfig.frequencyPenalty,
            presencePenalty: modelConfig.presencePenalty,
            ...(providerOptions ? { providerOptions } : {}),
        }
    }

    /**
     * DeepSeek v4 thinking models require every assistant message to include
     * reasoning_content, even when it is empty.
     */
    normalizeMessages(messages: ModelMessage[], modelConfig: ModelConfig, variant?: ModelVariant | null): ModelMessage[] {
        const thinkingEnabled = variant != null && variant !== 'off'

        if (!this.isThinkingModel(modelConfig) || !thinkingEnabled) {
            return messages
        }

        return messages.map((message) => {
            if (message.role !== 'assistant') return message

            if (Array.isArray(message.content)) {
                if (message.content.some((part: any) => part.type === 'reasoning')) {
                    return message
                }

                return {
                    ...message,
                    content: [...message.content, { type: 'reasoning' as const, text: '' }],
                }
            }

            return {
                ...message,
                content: [
                    ...(message.content ? [{ type: 'text' as const, text: message.content as string }] : []),
                    { type: 'reasoning' as const, text: '' },
                ],
            }
        })
    }
}