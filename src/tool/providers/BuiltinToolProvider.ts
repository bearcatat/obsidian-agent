import { ToolSet } from "ai";
import { BuiltinToolConfig } from "@/types";
import { ToolProvider } from "../ToolProvider";
import { ToolContext } from "../ToolContext";
import { BUILTIN_TOOL_REGISTRY } from "../registry/BuiltinToolRegistry";

export default class BuiltinToolProvider implements ToolProvider {
  private configs: BuiltinToolConfig[] = [];

  updateConfigs(configs: BuiltinToolConfig[]): void {
    this.configs = configs;
  }

  getAllTools(_context: ToolContext): ToolSet {
    return BUILTIN_TOOL_REGISTRY;
  }

  getEnabledTools(_context: ToolContext): ToolSet {
    const enabledToolNames = new Set(
      this.configs
        .filter((tool) => tool.enabled)
        .map((tool) => tool.name)
    );

    return Object.fromEntries(
      Object.entries(BUILTIN_TOOL_REGISTRY).filter(([toolName]) => enabledToolNames.has(toolName))
    );
  }
}
