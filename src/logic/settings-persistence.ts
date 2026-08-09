import { Plugin } from "obsidian";
import { settingsStore } from "@/state/settings-state-impl";
import { normalizeBuiltinTools } from "@/tool/BuiltinTools";
import type { SettingsStateData } from "@/state/settings-state";

let settingsPlugin: Plugin | undefined;

export function setSettingsPlugin(plugin: Plugin): void {
  settingsPlugin = plugin;
}

export async function persistSettingsStore(overrides: Partial<SettingsStateData> = {}): Promise<void> {
  if (!settingsPlugin) {
    console.warn("Settings plugin not set, skipping persistence");
    return;
  }

  const state = settingsStore.getState();
  
  const stateData = {
    models: overrides.models ?? state.models,
    defaultAgentModel: overrides.defaultAgentModel ?? state.defaultAgentModel,
    defaultAgentModelVariant: overrides.defaultAgentModelVariant ?? state.defaultAgentModelVariant,
    titleModel: overrides.titleModel ?? state.titleModel,
    titleModelVariant: overrides.titleModelVariant ?? state.titleModelVariant,
    imageModel: overrides.imageModel ?? state.imageModel,
    imageModelVariant: overrides.imageModelVariant ?? state.imageModelVariant,
    mcpServers: overrides.mcpServers ?? state.mcpServers,
    builtinTools: normalizeBuiltinTools(overrides.builtinTools ?? state.builtinTools),
    exaSearchConfig: overrides.exaSearchConfig ?? state.exaSearchConfig,
    bochaSearchConfig: overrides.bochaSearchConfig ?? state.bochaSearchConfig,
    telegramFeedbackConfig: overrides.telegramFeedbackConfig ?? state.telegramFeedbackConfig,
    bashPermissions: overrides.bashPermissions ?? state.bashPermissions,
    memorySettings: overrides.memorySettings ?? state.memorySettings,
  };

  await settingsPlugin.saveData(stateData);
}
