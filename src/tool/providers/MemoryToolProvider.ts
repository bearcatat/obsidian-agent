import { ToolSet } from "ai";
import { ToolProvider } from "../ToolProvider";
import { ToolContext } from "../ToolContext";
import { settingsStore } from "@/state/settings-state-impl";
import { MEMORY_TOOLS } from "../Memory/MemoryTools";

export default class MemoryToolProvider implements ToolProvider {
  getAllTools(_context: ToolContext): ToolSet {
    return MEMORY_TOOLS;
  }

  getEnabledTools(_context: ToolContext): ToolSet {
    const settings = settingsStore.getState().memorySettings;
    if (!settings.enabled) return {};
    return {
      memory_search: MEMORY_TOOLS.memory_search,
      memory_read: MEMORY_TOOLS.memory_read,
      memory_remember: MEMORY_TOOLS.memory_remember,
      memory_correct: MEMORY_TOOLS.memory_correct,
      memory_forget: MEMORY_TOOLS.memory_forget,
      memory_clear: MEMORY_TOOLS.memory_clear,
    };
  }
}
