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
}