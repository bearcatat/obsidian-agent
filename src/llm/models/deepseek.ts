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
    const isReasoner = modelConfig.name.includes('reasoner');
    const modelConfigOptions: any = {
      modelName: modelConfig.name,
      streaming: true,
      maxRetries: 3,
      maxConcurrency: 3,
      apiKey: modelConfig.apiKey,
      configuration: {
        baseURL: modelConfig.baseUrl || "https://api.deepseek.com/v1",
      },
      temperature: modelConfig.temperature,
      topP: modelConfig.topP,
      maxTokens: modelConfig.maxTokens,
      frequencyPenalty: modelConfig.frequencyPenalty,
    };
    
    // 如果使用reasoner模型或需要思考模式，添加thinking参数
    if (isReasoner) {
      modelConfigOptions.thinking = { type: "enabled" };
    }
    
    const model = new ChatDeepSeek(modelConfigOptions);
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
