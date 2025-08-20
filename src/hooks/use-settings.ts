import { useState, useEffect } from 'react';
import { SettingsState } from '../state/settings-state-impl';
import { SettingsLogic } from '../logic/settings-logic';
import { clone, ISettingsState } from '../state/settings-state';
import { ModelConfig, MCPServerConfig } from '../types';

export function useSettingsState(): ISettingsState {
  const [state, setState] = useState<ISettingsState>(() => SettingsState.getInstance());

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
    setBochaaiApiKey: async (bochaaiApiKey: string) => await settingsLogic.setBochaaiApiKey(bochaaiApiKey),
    // 模型设置
    setDefaultAgentModel: async (model: ModelConfig | null) => await settingsLogic.setDefaultAgentModel(model),
    setTitleModel: async (model: ModelConfig | null) => await settingsLogic.setTitleModel(model),
    // MCP服务器配置管理
    addOrUpdateMCPServer: async (server: MCPServerConfig, originalName?: string) => await settingsLogic.addOrUpdateMCPServer(server, originalName),
    removeMCPServer: async (serverName: string) => await settingsLogic.removeMCPServer(serverName),
    reorderMCPServers: async (newServers: MCPServerConfig[]) => await settingsLogic.reorderMCPServers(newServers),
  };
}
