import { ModelConfig, ModelVariant } from "@/types";
import { ModelMessage, ToolLoopAgentSettings } from "ai";
import DeepSeekProviderStrategy from "./model-provider-strategies/deepseek";
import AnthropicProviderStrategy from "./model-provider-strategies/anthropic";
import OpenAIProviderStrategy from "./model-provider-strategies/openai";
import MoonshotProviderStrategy from "./model-provider-strategies/moonshot";
import OpenAIFormatProviderStrategy from "./model-provider-strategies/openai-format";
import GoogleProviderStrategy from "./model-provider-strategies/google";
import ModelProviderRegistry from "./ModelProviderRegistry";

export default class AIModelManager {
    private static instance: AIModelManager;

    public agentModelConfig: ModelConfig | null = null;
    public currentVariant: ModelVariant | null = null;
    public titleModelConfig: ModelConfig | null = null;
    public titleModelVariant: ModelVariant | null = null;
    private providerRegistry = new ModelProviderRegistry([
        new DeepSeekProviderStrategy(),
        new AnthropicProviderStrategy(),
        new OpenAIProviderStrategy(),
        new MoonshotProviderStrategy(),
        new OpenAIFormatProviderStrategy(),
        new GoogleProviderStrategy(),
    ])

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
    }

    setVariant(variant: ModelVariant | null) {
        this.currentVariant = variant
    }

    setTitle(modelConfig: ModelConfig, variant?: ModelVariant | null) {
        this.titleModelConfig = modelConfig
        this.titleModelVariant = null
    }

    buildAgentConfig(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        return this.providerRegistry.get(modelConfig.provider).buildAgentConfig(modelConfig, variant)
    }

    getAgentConfig(): ToolLoopAgentSettings {
        if (!this.agentModelConfig) {
            throw new Error("agent model not configured")
        }

        return this.buildAgentConfig(this.agentModelConfig, this.currentVariant ?? undefined)
    }

    getTitleConfig(): ToolLoopAgentSettings {
        if (!this.titleModelConfig) {
            throw new Error("title model not configured")
        }

        return this.buildAgentConfig(this.titleModelConfig)
    }

    normalizeMessages(
        messages: ModelMessage[],
        modelConfig: ModelConfig | null = this.agentModelConfig,
        variant: ModelVariant | null = this.currentVariant,
    ): ModelMessage[] {
        if (!modelConfig) return messages

        const strategy = this.providerRegistry.find(modelConfig.provider)
        return strategy?.normalizeMessages?.(messages, modelConfig, variant) ?? messages
    }
}
