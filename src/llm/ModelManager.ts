import { AIModelGenerator, ModelConfig, ModelProviders, ModelVariant } from "@/types";
import { ModelMessage, ToolLoopAgentSettings } from "ai";
import DeepSeekGenerator from "./models/deepseek";
import AnthropicGenerator from "./models/anthropic";
import OpenAIGenerator from "./models/openai";
import MoonshotGenerator from "./models/moonshot";
import OpenAIFormatGenerator from "./models/openai-format";
import GoogleGenerator from "./models/google";

export default class AIModelManager {
    private static instance: AIModelManager;

    public agentModelConfig: ModelConfig | null = null;
    public currentVariant: ModelVariant | null = null;
    public titleModelConfig: ModelConfig | null = null;
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
    }

    setVariant(variant: ModelVariant | null) {
        this.currentVariant = variant
    }

    setTitle(modelConfig: ModelConfig) {
        this.titleModelConfig = modelConfig
    }

    buildAgentConfig(modelConfig: ModelConfig, variant?: ModelVariant): ToolLoopAgentSettings {
        const generator = this.modelGenerators[modelConfig.provider]
        if (generator) {
            return generator.buildAgentConfig(modelConfig, variant)
        }
        throw new Error("provider not found")
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

        const generator = this.modelGenerators[modelConfig.provider]
        return generator?.normalizeMessages?.(messages, modelConfig, variant) ?? messages
    }
}