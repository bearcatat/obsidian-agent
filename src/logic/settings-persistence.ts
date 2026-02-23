import { Plugin } from "obsidian";
import { settingsStore } from "@/state/settings-state-impl";
import { getDefaultBuiltinTools } from "@/tool-ai/BuiltinTools";

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
    titleModel: state.titleModel,
    mcpServers: state.mcpServers,
    builtinTools: state.builtinTools,
    exaSearchConfig: state.exaSearchConfig,
    bochaSearchConfig: state.bochaSearchConfig,
    bashPermissions: state.bashPermissions,
  };

  await settingsPlugin.saveData(stateData);
}
