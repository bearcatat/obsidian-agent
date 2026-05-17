import { ToolSet } from "ai";
import { ExaSearchConfig } from "@/types";
import { ExaWebSearchTool, toolName as ExaWebSearchToolName, updateExaConfig } from "../ExaSearch/ExaSearchTool";
import { ToolProvider } from "../ToolProvider";
import { ToolContext } from "../ToolContext";

const DEFAULT_EXA_CONFIG: ExaSearchConfig = {
  apiKey: "",
  enabled: false,
  numResults: 10,
  maxCharacters: 3000,
  livecrawl: "fallback",
};

export default class ExaSearchToolProvider implements ToolProvider {
  private config: ExaSearchConfig = DEFAULT_EXA_CONFIG;

  updateConfig(config: ExaSearchConfig): void {
    this.config = config;
    updateExaConfig(config);
  }

  getAllTools(_context: ToolContext): ToolSet {
    return { [ExaWebSearchToolName]: ExaWebSearchTool };
  }

  getEnabledTools(_context: ToolContext): ToolSet {
    if (!this.config.enabled || !this.config.apiKey) {
      return {};
    }

    return { [ExaWebSearchToolName]: ExaWebSearchTool };
  }
}
