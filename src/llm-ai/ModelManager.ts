import { AIModelGenerator, ModelConfig, ModelProviders, ModelVariant } from "@/types";
import { ToolLoopAgentSettings } from "ai";
import DeepSeekGenerator from "./models/deepseek";
import AnthropicGenerator from "./models/anthropic";
import OpenAIGenerator from "./models/openai";
import MoonshotGenerator from "./models/moonshot";
import OpenAIFormatGenerator from "./models/openai-format";
import GoogleGenerator from "./models/google";

export default class AIModelManager {
    private static instance: AIModelManager;

    public agentConfig: ToolLoopAgentSettings;
    public agentModelConfig: ModelConfig;
    public currentVariant: ModelVariant | null = null;
    public titleConfig: ToolLoopAgentSettings;
    private modelGenerators: Record<string, AIModelGenerator> = {
        [ModelProviders.DEEPSEEK]: DeepSeekGenerator.getInstance(),
        [ModelProviders.ANTHROPIC]: AnthropicGenerator.getInstance(),
        [ModelProviders.OPENAI]: OpenAIGenerator.getInstance(),
        [ModelProviders.MOONSHOT]: MoonshotGenerator.getInstance(),
        [ModelProviders.OPENAI_FORMAT]: OpenAIFormatGenerator.getInstance(),
        [ModelProviders.GOOGLE]: GoogleGenerator.getInstance(),
    }

    static getInstance(): AIModelManager {
        if (!AIModelManager.instance) {
            AIModelManager.instance = new AIModelManager();
        }
        return AIModelManager.instance;
    }

    static resetInstance(): void {
        AIModelManager.instance = undefined as any;
    }

    setAgent(modelConfig: ModelConfig, variant?: ModelVariant | null) {
        this.agentModelConfig = modelConfig
        this.currentVariant = variant ?? null
        const generator = this.modelGenerators[modelConfig.provider]
        if (generator) {
            this.agentConfig = generator.newAgent(modelConfig, variant ?? undefined)
        }
    }

    setVariant(variant: ModelVariant | null) {
        this.currentVariant = variant
        if (this.agentModelConfig) {
            const generator = this.modelGenerators[this.agentModelConfig.provider]
            if (generator) {
                this.agentConfig = generator.newAgent(this.agentModelConfig, variant ?? undefined)
            }
        }
    }

    setTitle(modelConfig: ModelConfig) {
        const generator = this.modelGenerators[modelConfig.provider]
        if (generator) {
            this.titleConfig = generator.newAgent(modelConfig)
        }
    }

    getAgent(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        const generator = this.modelGenerators[modelConfig.provider]
        if (generator) {
            return generator.newAgent(modelConfig, variant)
        }
        throw new Error("provider not found")
    }

    /**
     * Normalize messages before sending to the LLM.
     * Applies provider-specific fixes to the message history.
     *
     * DeepSeek v4 (thinking models): requires ALL assistant messages to carry
     * reasoning_content, even an empty string. We use @ai-sdk/openai-compatible
     * (instead of @ai-sdk/deepseek) because the openai-compatible provider does NOT
     * strip reasoning parts from historical messages — it serializes every
     * { type: "reasoning" } part as reasoning_content in the API request regardless
     * of message position. We inject { type: "reasoning", text: "" } into any
     * assistant message that lacks one so the API requirement is satisfied.
     * (Same approach used by opencode/packages/opencode/src/provider/transform.ts)
     */
    normalizeMessages(messages: import('ai').ModelMessage[]): import('ai').ModelMessage[] {
        if (!this.agentModelConfig) return messages
        const modelId = this.agentModelConfig.name
        const isDeepSeek = this.agentModelConfig.provider === ModelProviders.DEEPSEEK
        const isThinkingModel = modelId.includes('v4-pro') || modelId.includes('v4-flash')
        const thinkingEnabled = this.currentVariant != null && this.currentVariant !== 'off'

        if (isDeepSeek && isThinkingModel && thinkingEnabled) {
            return messages.map((msg) => {
                if (msg.role !== 'assistant') return msg
                if (Array.isArray(msg.content)) {
                    if (msg.content.some((part: any) => part.type === 'reasoning')) return msg
                    return { ...msg, content: [...msg.content, { type: 'reasoning' as const, text: '' }] }
                }
                return {
                    ...msg,
                    content: [
                        ...(msg.content ? [{ type: 'text' as const, text: msg.content as string }] : []),
                        { type: 'reasoning' as const, text: '' },
                    ],
                }
            })
        }

        return messages
    }
}