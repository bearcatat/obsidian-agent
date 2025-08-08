import { ChatDeepSeek } from "@langchain/deepseek";
import { ModelConfig, ModelProviders, Streamer } from "@/types";
import GeneralStreamer from "../GeneralStreamer";

export default class DeepSeekGenerator {
  private static instance: DeepSeekGenerator;

  static getInstance(): DeepSeekGenerator {
    if (!DeepSeekGenerator.instance) {
      DeepSeekGenerator.instance = new DeepSeekGenerator();
    }
    return DeepSeekGenerator.instance;
  }

  async newModel(modelConfig: ModelConfig): Promise<ChatDeepSeek> {
    const model = new ChatDeepSeek({
      modelName: modelConfig.name,
      streaming: true,
      maxRetries: 3,
      maxConcurrency: 3,
      apiKey: modelConfig.apiKey,
      configuration: {
        baseURL: modelConfig.baseUrl,
      },
      temperature: modelConfig.temperature,
      topP: modelConfig.topP,
      maxTokens: modelConfig.maxTokens,
      frequencyPenalty: modelConfig.frequencyPenalty,
    });
    return model;
  }

  async newStreamer(modelConfig: ModelConfig): Promise<Streamer> {
    const model = await this.newModel(modelConfig);
    return new GeneralStreamer(model);
  }

  matchModel(modelConfig: ModelConfig): boolean {
    return modelConfig.provider === ModelProviders.DEEPSEEK;
  }
}
