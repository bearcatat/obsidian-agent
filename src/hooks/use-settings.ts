import { useSettingsStore, settingsStore } from '../state/settings-state-impl';
import { SettingsLogic } from '../logic/settings-logic';
import { useShallow } from 'zustand/react/shallow';
import { ModelConfig, MCPServerConfig, ExaSearchConfig, BochaSearchConfig, BashPermissionConfig } from '../types';

export { useSettingsStore };

export function useSettingsState() {
  return useSettingsStore(
    useShallow((state) => ({
      models: state.models,
      defaultAgentModel: state.defaultAgentModel,
      titleModel: state.titleModel,
      mcpServers: state.mcpServers,
      builtinTools: state.builtinTools,
      exaSearchConfig: state.exaSearchConfig,
      bochaSearchConfig: state.bochaSearchConfig,
      bashPermissions: state.bashPermissions,
    }))
  );
}

export function useSettingsLogic() {
  const settingsLogic = SettingsLogic.getInstance();

  return {
    addOrUpdateModel: async (model: ModelConfig, originalId?: string) =>
      await settingsLogic.addOrUpdateModel(model, originalId),
    removeModel: async (modelId: string) => await settingsLogic.removeModel(modelId),
    reorderModels: async (newModels: ModelConfig[]) => await settingsLogic.reorderModels(newModels),

    setDefaultAgentModel: async (model: ModelConfig | null) =>
      await settingsLogic.setDefaultAgentModel(model),
    setTitleModel: async (model: ModelConfig | null) => await settingsLogic.setTitleModel(model),

    addOrUpdateMCPServer: async (server: MCPServerConfig, originalName?: string) =>
      await settingsLogic.addOrUpdateMCPServer(server, originalName),
    removeMCPServer: async (serverName: string) => await settingsLogic.removeMCPServer(serverName),
    reorderMCPServers: async (newServers: MCPServerConfig[]) =>
      await settingsLogic.reorderMCPServers(newServers),

    updateBuiltinTool: async (toolName: string, enabled: boolean) =>
      await settingsLogic.updateBuiltinTool(toolName, enabled),

    getMCPTools: async (server: MCPServerConfig) => await settingsLogic.getMCPTools(server),
    getAIMCPTools: async (server: MCPServerConfig) => await settingsLogic.getAIMCPTools(server),

    updateExaSearchConfig: async (config: ExaSearchConfig) =>
      await settingsLogic.updateExaSearchConfig(config),
    setExaSearchEnabled: async (enabled: boolean) =>
      await settingsLogic.setExaSearchEnabled(enabled),

    updateBochaSearchConfig: async (config: BochaSearchConfig) =>
      await settingsLogic.updateBochaSearchConfig(config),
    setBochaSearchEnabled: async (enabled: boolean) =>
      await settingsLogic.setBochaSearchEnabled(enabled),

    updateBashPermissions: async (config: BashPermissionConfig) =>
      await settingsLogic.updateBashPermissions(config),
  };
}

export function useSettings() {
  const state = useSettingsState();
  const logic = useSettingsLogic();

  return {
    ...state,
    ...logic,
  };
}
