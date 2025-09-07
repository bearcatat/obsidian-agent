import { ChatOpenAI } from "@langchain/openai";
import { ModelConfig, ModelProviders, Streamer } from "@/types";
import GeneralStreamer from "../GeneralStreamer";

export default class OpenAIGenerator {
  private static instance: OpenAIGenerator;

  static getInstance(): OpenAIGenerator {
    if (!OpenAIGenerator.instance) {
      OpenAIGenerator.instance = new OpenAIGenerator();
    }
    return OpenAIGenerator.instance;
  }

  async newModel(modelConfig: ModelConfig): Promise<ChatOpenAI> {
    const isOSeries = modelConfig.name.startsWith("o");
    const isGPT5Series = modelConfig.name.startsWith("gpt-5");
    const model = new ChatOpenAI({
      modelName: modelConfig.name,
      streaming: true,
      maxRetries: 3,
      maxConcurrency: 3,
      apiKey: modelConfig.apiKey,
      configuration: {
        baseURL: modelConfig.baseUrl || "https://api.openai.com/v1",
      },
      ...(isOSeries || isGPT5Series
        ? {
            maxCompletionTokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature === undefined ? undefined : 1,
          }
        : {
            maxTokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature,
            topP: modelConfig.topP,
            frequencyPenalty: modelConfig.frequencyPenalty,
          }),
    });
    return model;
  }

  async newStreamer(modelConfig: ModelConfig): Promise<Streamer> {
    const model = await this.newModel(modelConfig);
    return new GeneralStreamer(model);
  }

  matchModel(modelConfig: ModelConfig): boolean {
    return modelConfig.provider === ModelProviders.OPENAI;
  }
}
