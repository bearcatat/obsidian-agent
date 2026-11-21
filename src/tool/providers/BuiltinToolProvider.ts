import { ToolSet } from "ai";
import { BuiltinToolConfig } from "@/types";
import { ToolProvider } from "../ToolProvider";
import { ToolContext } from "../ToolContext";
import { BUILTIN_TOOL_REGISTRY } from "../registry/BuiltinToolRegistry";
import { isBashHostPlatformSupported } from "../Bash/execute-command";

export default class BuiltinToolProvider implements ToolProvider {
  private configs: BuiltinToolConfig[] = [];

  updateConfigs(configs: BuiltinToolConfig[]): void {
    this.configs = configs;
  }

  getAllTools(_context: ToolContext): ToolSet {
    return this.filterUnsupportedTools(BUILTIN_TOOL_REGISTRY);
  }

  getEnabledTools(_context: ToolContext): ToolSet {
    const enabledToolNames = new Set(
      this.configs
        .filter((tool) => tool.enabled)
        .map((tool) => tool.name)
    );

    return Object.fromEntries(
      Object.entries(this.filterUnsupportedTools(BUILTIN_TOOL_REGISTRY)).filter(([toolName]) => enabledToolNames.has(toolName))
    );
  }

  private filterUnsupportedTools(tools: ToolSet): ToolSet {
    if (isBashHostPlatformSupported()) return tools;
    const { bash: _bash, ...supported } = tools;
    return supported;
  }
}
