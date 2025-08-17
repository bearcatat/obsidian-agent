import { ChatAnthropic } from "@langchain/anthropic";
import { ModelConfig, ModelProviders, Streamer } from "@/types";
import GeneralStreamer from "../GeneralStreamer";

export default class AnthropicGenerator {
  private static instance: AnthropicGenerator;

  static getInstance(): AnthropicGenerator {
    if (!AnthropicGenerator.instance) {
      AnthropicGenerator.instance = new AnthropicGenerator();
    }
    return AnthropicGenerator.instance;
  }

  async newModel(modelConfig: ModelConfig): Promise<ChatAnthropic> {
    // 暂时禁用 thinking 功能以避免消息格式问题
    const isThinkingEnabled = false; // 
      // modelConfig.name.startsWith("claude-3-7-sonnet") ||
      // modelConfig.name.startsWith("claude-sonnet-4");

    // 当启用 thinking 时，确保 maxTokens 大于 budget_tokens
    const budgetTokens = 1024;
    const minMaxTokens = budgetTokens + 100; // 至少比 budget_tokens 大 100
    const maxTokens = isThinkingEnabled 
      ? Math.max(modelConfig.maxTokens || minMaxTokens, minMaxTokens)
      : modelConfig.maxTokens;

    const config: any = {
      model: modelConfig.name,
      streaming: true,
      maxRetries: 3,
      maxConcurrency: 3,
      anthropicApiKey: modelConfig.apiKey,
      anthropicApiUrl: modelConfig.baseUrl || "https://api.anthropic.com/v1",
      clientOptions: {
        defaultHeaders: {
          "anthropic-dangerous-direct-browser-access": "true",
        },
      },
      maxTokens: maxTokens,
    };

    if (isThinkingEnabled) {
      config.thinking = { type: "enabled", budget_tokens: budgetTokens };
    } else {
      config.temperature = modelConfig.temperature;
      config.topP = modelConfig.topP;
    }

    const model = new ChatAnthropic(config);
    return model;
  }

  async newStreamer(modelConfig: ModelConfig): Promise<Streamer> {
    const model = await this.newModel(modelConfig);
    return new GeneralStreamer(model);
  }

  matchModel(modelConfig: ModelConfig): boolean {
    return modelConfig.provider === ModelProviders.ANTHROPIC;
  }
}
