import { ChatOpenAI } from "@langchain/openai";
import { ModelConfig, ModelProviders, Streamer } from "@/types";
import GeneralStreamer from "../GeneralStreamer";

export default class MoonshotGenerator {
  private static instance: MoonshotGenerator;

  static getInstance(): MoonshotGenerator {
    if (!MoonshotGenerator.instance) {
      MoonshotGenerator.instance = new MoonshotGenerator();
    }
    return MoonshotGenerator.instance;
  }

  async newModel(modelConfig: ModelConfig): Promise<ChatOpenAI> {
    const model = new ChatOpenAI({
      modelName: modelConfig.name,
      streaming: true,
      maxRetries: 3,
      maxConcurrency: 3,
      apiKey: modelConfig.apiKey,
      configuration: {
        baseURL: modelConfig.baseUrl,
        defaultHeaders: { "dangerously-allow-browser": "true" },
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
    return modelConfig.provider === ModelProviders.MOONSHOT;
  }
}
