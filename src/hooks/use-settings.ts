import { useState, useEffect } from "react";
import { SettingsLogic } from "../logic/settings-logic";
import { SettingsState } from "../state/settings-state-impl";
import { ISettingsState, clone } from "../state/settings-state";
import { ModelConfig, MCPServerConfig, SubAgentConfig } from "../types";

export function useSettingsState(): ISettingsState {
  const [state, setState] = useState<ISettingsState>(() => {
    const instance = SettingsState.getInstance();
    return clone(instance);
  });

  useEffect(() => {
    const settingsState = SettingsState.getInstance();
    const unsubscribe = settingsState.subscribe(() => {
      setState(clone(settingsState));
    });
    return unsubscribe;
  }, []);

  return state;
}

export function useSettingsLogic() {
  const settingsLogic = SettingsLogic.getInstance();

  return {
    // 模型管理
    addOrUpdateModel: async (model: ModelConfig, originalId?: string) => await settingsLogic.addOrUpdateModel(model, originalId),
    removeModel: async (modelId: string) => await settingsLogic.removeModel(modelId),
    reorderModels: async (newModels: ModelConfig[]) => await settingsLogic.reorderModels(newModels),

    // 模型设置
    setDefaultAgentModel: async (model: ModelConfig | null) => await settingsLogic.setDefaultAgentModel(model),
    setTitleModel: async (model: ModelConfig | null) => await settingsLogic.setTitleModel(model),

    // MCP服务器配置管理
    addOrUpdateMCPServer: async (server: MCPServerConfig, originalName?: string) => await settingsLogic.addOrUpdateMCPServer(server, originalName),
    removeMCPServer: async (serverName: string) => await settingsLogic.removeMCPServer(serverName),
    reorderMCPServers: async (newServers: MCPServerConfig[]) => await settingsLogic.reorderMCPServers(newServers),

    // 内置工具管理
    updateBuiltinTool: async (toolName: string, enabled: boolean) => await settingsLogic.updateBuiltinTool(toolName, enabled),

    // SubAgent配置管理
    addOrUpdateSubAgent: async (subAgent: SubAgentConfig, originalName?: string) => await settingsLogic.addOrUpdateSubAgent(subAgent, originalName),
    removeSubAgent: async (subAgentName: string) => await settingsLogic.removeSubAgent(subAgentName),
    reorderSubAgents: async (newSubAgents: SubAgentConfig[]) => await settingsLogic.reorderSubAgents(newSubAgents),

    // 获取MCP工具
    getMCPTools: async (server: MCPServerConfig) => await settingsLogic.getMCPTools(server),
    getAIMCPTools: async (server: MCPServerConfig) => await settingsLogic.getAIMCPTools(server),
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
