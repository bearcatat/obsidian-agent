import { Plugin } from "obsidian";
import { settingsStore } from "@/state/settings-state-impl";
import { normalizeBuiltinTools } from "@/tool/BuiltinTools";

let settingsPlugin: Plugin | undefined;

export function setSettingsPlugin(plugin: Plugin): void {
  settingsPlugin = plugin;
}

export async function persistSettingsStore(): Promise<void> {
  if (!settingsPlugin) {
    console.warn("Settings plugin not set, skipping persistence");
    return;
  }

  const state = settingsStore.getState();
  
  const stateData = {
    models: state.models,
    defaultAgentModel: state.defaultAgentModel,
    defaultAgentModelVariant: state.defaultAgentModelVariant,
    titleModel: state.titleModel,
    titleModelVariant: state.titleModelVariant,
    imageModel: state.imageModel,
    imageModelVariant: state.imageModelVariant,
    mcpServers: state.mcpServers,
    builtinTools: normalizeBuiltinTools(state.builtinTools),
    exaSearchConfig: state.exaSearchConfig,
    bochaSearchConfig: state.bochaSearchConfig,
    telegramFeedbackConfig: state.telegramFeedbackConfig,
    bashPermissions: state.bashPermissions,
    memorySettings: state.memorySettings,
  };

  await settingsPlugin.saveData(stateData);
}
