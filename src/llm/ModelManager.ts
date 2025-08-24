import { ModelConfig, ModelGenerator, Streamer } from "@/types";
import DeepSeekGenerator from "./models/deepseek";
import OpenAIGenerator from "./models/openai";
import AnthropicGenerator from "./models/anthropic";
import OpenAIFormatGenerator from "./models/openai-format";
import MoonshotGenerator from "./models/moonshot";

export default class ModelManager {
  private static instance: ModelManager;
  private static agentModel: Streamer;
  private static titleModel: Streamer;
  private static modelGenerators: ModelGenerator[] = [
    DeepSeekGenerator.getInstance(),
    OpenAIGenerator.getInstance(),
    AnthropicGenerator.getInstance(),
    OpenAIFormatGenerator.getInstance(),
    MoonshotGenerator.getInstance(),
  ];

  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  async setAgentModel(modelConfig: ModelConfig): Promise<void> {
    ModelManager.agentModel = await this.createStreamer(modelConfig);
  }

  async setTitleModel(modelConfig: ModelConfig): Promise<void> {
    ModelManager.titleModel = await this.createStreamer(modelConfig);
  }

  async createStreamer(modelConfig: ModelConfig): Promise<Streamer> {
    const modelGenerator = this.getModelGenerator(modelConfig);
    return await modelGenerator.newStreamer(modelConfig);
  }

  private getModelGenerator(modelConfig: ModelConfig): ModelGenerator {
    const modelGenerator = ModelManager.modelGenerators.find((generator) =>
      generator.matchModel(modelConfig)
    );
    if (!modelGenerator) {
      throw new Error(`No model generator found for: ${modelConfig.name}`);
    }
    return modelGenerator;
  }

  getAgentModel(): Streamer {
    if (!ModelManager.agentModel) {
      throw new Error("Agent model not set");
    }
    return ModelManager.agentModel;
  }

  getTitleModel(): Streamer {
    if (!ModelManager.titleModel) {
      // 如果没有设置标题模型，返回agent模型作为后备
      return this.getAgentModel();
    }
    return ModelManager.titleModel;
  }

  static resetInstance(): void {
    ModelManager.instance = undefined as any;
    ModelManager.agentModel = undefined as any;
    ModelManager.titleModel = undefined as any;
  }
}
