import { ToolSet } from "ai";
import { BochaSearchConfig } from "@/types";
import { BochaWebSearchTool, toolName as BochaWebSearchToolName, updateBochaConfig } from "../BochaSearch/BochaSearchTool";
import { ToolProvider } from "../ToolProvider";
import { ToolContext } from "../ToolContext";

const DEFAULT_BOCHA_CONFIG: BochaSearchConfig = {
  apiKey: "",
  enabled: false,
  count: 10,
  freshness: "noLimit",
};

export default class BochaSearchToolProvider implements ToolProvider {
  private config: BochaSearchConfig = DEFAULT_BOCHA_CONFIG;

  updateConfig(config: BochaSearchConfig): void {
    this.config = config;
    updateBochaConfig(config);
  }

  getAllTools(_context: ToolContext): ToolSet {
    return { [BochaWebSearchToolName]: BochaWebSearchTool };
  }

  getEnabledTools(_context: ToolContext): ToolSet {
    if (!this.config.enabled || !this.config.apiKey) {
      return {};
    }

    return { [BochaWebSearchToolName]: BochaWebSearchTool };
  }
}
