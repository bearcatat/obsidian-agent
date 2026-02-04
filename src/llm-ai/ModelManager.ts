import { AIModelGenerator, ModelConfig, ModelProviders } from "@/types";
import { ToolLoopAgentSettings } from "ai";
import DeepSeekGenerator from "./models/deepseek";
import AnthropicGenerator from "./models/anthropic";
import OpenAIGenerator from "./models/openai";
import MoonshotGenerator from "./models/moonshot";
import OpenAIFormatGenerator from "./models/openai-format";

export default class AIModelManager {
    private static instance: AIModelManager;

    public agentConfig: ToolLoopAgentSettings;
    public titleConfig: ToolLoopAgentSettings;
    private modelGenerators: Record<string, AIModelGenerator> = {
        [ModelProviders.DEEPSEEK]: DeepSeekGenerator.getInstance(),
        [ModelProviders.ANTHROPIC]: AnthropicGenerator.getInstance(),
        [ModelProviders.OPENAI]: OpenAIGenerator.getInstance(),
        [ModelProviders.MOONSHOT]: MoonshotGenerator.getInstance(),
        [ModelProviders.OPENAI_FORMAT]: OpenAIFormatGenerator.getInstance(),
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

    setAgent(modelConfig: ModelConfig) {
        const generator = this.modelGenerators[modelConfig.provider]
        if (generator) {
            this.agentConfig = generator.newAgent(modelConfig)
        }
    }

    setTitle(modelConfig: ModelConfig) {
        const generator = this.modelGenerators[modelConfig.provider]
        if (generator) {
            this.titleConfig = generator.newAgent(modelConfig)
        }
    }

    getAgent(modelConfig: ModelConfig): ToolLoopAgentSettings {
        const generator = this.modelGenerators[modelConfig.provider]
        if (generator) {
            return generator.newAgent(modelConfig)
        }
        throw new Error("provider not found")
    }
}