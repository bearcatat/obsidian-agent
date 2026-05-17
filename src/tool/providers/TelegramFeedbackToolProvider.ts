import { ToolSet } from "ai";
import { TelegramFeedbackConfig } from "@/types";
import { createDefaultTelegramFeedbackConfig } from "@/types";
import { TelegramFeedbackTool, toolName as TelegramFeedbackToolName } from "../TelegramFeedback/TelegramFeedbackTool";
import { ToolProvider } from "../ToolProvider";
import { ToolContext } from "../ToolContext";

export default class TelegramFeedbackToolProvider implements ToolProvider {
  private config: TelegramFeedbackConfig = createDefaultTelegramFeedbackConfig();

  updateConfig(config: TelegramFeedbackConfig): void {
    this.config = config;
  }

  getAllTools(_context: ToolContext): ToolSet {
    return { [TelegramFeedbackToolName]: TelegramFeedbackTool };
  }

  getEnabledTools(_context: ToolContext): ToolSet {
    if (!this.config.enabled || !this.config.botToken.trim() || !this.config.boundChatId || !this.config.boundUserId) {
      return {};
    }

    return { [TelegramFeedbackToolName]: TelegramFeedbackTool };
  }
}
