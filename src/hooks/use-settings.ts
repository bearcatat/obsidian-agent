import { useSettingsStore, settingsStore } from '../state/settings-state-impl';
import { SettingsLogic } from '../logic/settings-logic';
import { useShallow } from 'zustand/react/shallow';
import { ModelConfig, MCPServerConfig, SubAgentConfig, ExaSearchConfig, BochaSearchConfig } from '../types';

// 导出 store hook，组件可以直接使用
export { useSettingsStore };

// 保留向后兼容的 hook（从 store 中选择状态）
export function useSettingsState() {
  return useSettingsStore(
    useShallow((state) => ({
      models: state.models,
      defaultAgentModel: state.defaultAgentModel,
      titleModel: state.titleModel,
      mcpServers: state.mcpServers,
      builtinTools: state.builtinTools,
      subAgents: state.subAgents,
      exaSearchConfig: state.exaSearchConfig,
      bochaSearchConfig: state.bochaSearchConfig,
    }))
  );
}

export function useSettingsLogic() {
  const settingsLogic = SettingsLogic.getInstance();

  return {
    // 模型管理
    addOrUpdateModel: async (model: ModelConfig, originalId?: string) =>
      await settingsLogic.addOrUpdateModel(model, originalId),
    removeModel: async (modelId: string) => await settingsLogic.removeModel(modelId),
    reorderModels: async (newModels: ModelConfig[]) => await settingsLogic.reorderModels(newModels),

    // 模型设置
    setDefaultAgentModel: async (model: ModelConfig | null) =>
      await settingsLogic.setDefaultAgentModel(model),
    setTitleModel: async (model: ModelConfig | null) => await settingsLogic.setTitleModel(model),

    // MCP服务器配置管理
    addOrUpdateMCPServer: async (server: MCPServerConfig, originalName?: string) =>
      await settingsLogic.addOrUpdateMCPServer(server, originalName),
    removeMCPServer: async (serverName: string) => await settingsLogic.removeMCPServer(serverName),
    reorderMCPServers: async (newServers: MCPServerConfig[]) =>
      await settingsLogic.reorderMCPServers(newServers),

    // 内置工具管理
    updateBuiltinTool: async (toolName: string, enabled: boolean) =>
      await settingsLogic.updateBuiltinTool(toolName, enabled),

    // SubAgent配置管理
    addOrUpdateSubAgent: async (subAgent: SubAgentConfig, originalName?: string) =>
      await settingsLogic.addOrUpdateSubAgent(subAgent, originalName),
    removeSubAgent: async (subAgentName: string) => await settingsLogic.removeSubAgent(subAgentName),
    reorderSubAgents: async (newSubAgents: SubAgentConfig[]) =>
      await settingsLogic.reorderSubAgents(newSubAgents),

    // 获取MCP工具
    getMCPTools: async (server: MCPServerConfig) => await settingsLogic.getMCPTools(server),
    getAIMCPTools: async (server: MCPServerConfig) => await settingsLogic.getAIMCPTools(server),

    // Exa搜索配置管理
    updateExaSearchConfig: async (config: ExaSearchConfig) =>
      await settingsLogic.updateExaSearchConfig(config),
    setExaSearchEnabled: async (enabled: boolean) =>
      await settingsLogic.setExaSearchEnabled(enabled),

    // Bocha搜索配置管理
    updateBochaSearchConfig: async (config: BochaSearchConfig) =>
      await settingsLogic.updateBochaSearchConfig(config),
    setBochaSearchEnabled: async (enabled: boolean) =>
      await settingsLogic.setBochaSearchEnabled(enabled),
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
