import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ModelConfig, MCPServerConfig, BuiltinToolConfig, SubAgentConfig } from '../types';
import { getDefaultBuiltinTools } from '../tool-ai/BuiltinTools';
import AIModelManager from '../llm-ai/ModelManager';
import { SettingsStateData } from './settings-state';

interface SettingsStore extends SettingsStateData {
  // 模型管理
  addOrUpdateModel: (model: ModelConfig, originalId?: string) => void;
  removeModel: (modelId: string) => void;
  reorderModels: (newModels: ModelConfig[]) => void;
  setDefaultAgentModel: (model: ModelConfig | null) => void;
  setTitleModel: (model: ModelConfig | null) => void;

  // MCP服务器配置管理
  addOrUpdateMCPServer: (server: MCPServerConfig, originalName?: string) => void;
  removeMCPServer: (serverName: string) => void;
  reorderMCPServers: (newServers: MCPServerConfig[]) => void;

  // 内置工具管理
  updateBuiltinTool: (toolName: string, enabled: boolean) => void;

  // SubAgent配置管理
  addOrUpdateSubAgent: (subAgent: SubAgentConfig, originalName?: string) => void;
  removeSubAgent: (subAgentName: string) => void;
  reorderSubAgents: (newSubAgents: SubAgentConfig[]) => void;

  // 批量设置数据（用于加载）
  setAllData: (data: SettingsStateData) => void;
}

const initialState: SettingsStateData = {
  models: [],
  defaultAgentModel: null,
  titleModel: null,
  mcpServers: [],
  builtinTools: getDefaultBuiltinTools(),
  subAgents: [],
};

export const useSettingsStore = create<SettingsStore>()(
  immer((set) => ({
    ...initialState,

    addOrUpdateModel: (model: ModelConfig, originalId?: string) =>
      set((state) => {
        const targetId = originalId || model.id;
        const existingIndex = state.models.findIndex((m) => m.id === targetId);

        if (existingIndex >= 0) {
          // 更新现有模型
          state.models[existingIndex] = model;
        } else {
          // 添加新模型
          state.models.push(model);
        }

        // Check if the updated model is being used by AIModelManager and reconfigure if needed
        const modelManager = AIModelManager.getInstance();

        // Check if this model is the default agent model
        if (state.defaultAgentModel?.id === targetId) {
          state.defaultAgentModel = model;
          modelManager.setAgent(model);
        }

        // Check if this model is the title model
        if (state.titleModel?.id === targetId) {
          state.titleModel = model;
          modelManager.setTitle(model);
        }
      }),

    removeModel: (modelId: string) =>
      set((state) => {
        state.models = state.models.filter((model) => model.id !== modelId);

        // 如果删除的模型是默认模型或标题模型，则清空对应设置
        if (state.defaultAgentModel?.id === modelId) {
          state.defaultAgentModel = null;
        }
        if (state.titleModel?.id === modelId) {
          state.titleModel = null;
        }
      }),

    reorderModels: (newModels: ModelConfig[]) =>
      set((state) => {
        state.models = newModels;
      }),

    setDefaultAgentModel: (model: ModelConfig | null) =>
      set((state) => {
        state.defaultAgentModel = model;
      }),

    setTitleModel: (model: ModelConfig | null) =>
      set((state) => {
        state.titleModel = model;
      }),

    addOrUpdateMCPServer: (server: MCPServerConfig, originalName?: string) =>
      set((state) => {
        const existingIndex = state.mcpServers.findIndex(
          (s) => s.name === (originalName || server.name)
        );

        if (existingIndex >= 0) {
          // 更新现有服务器
          state.mcpServers[existingIndex] = server;
        } else {
          // 添加新服务器
          state.mcpServers.push(server);
        }
      }),

    removeMCPServer: (serverName: string) =>
      set((state) => {
        state.mcpServers = state.mcpServers.filter((server) => server.name !== serverName);
      }),

    reorderMCPServers: (newServers: MCPServerConfig[]) =>
      set((state) => {
        state.mcpServers = newServers;
      }),

    updateBuiltinTool: (toolName: string, enabled: boolean) =>
      set((state) => {
        const toolIndex = state.builtinTools.findIndex((tool) => tool.name === toolName);
        if (toolIndex >= 0) {
          state.builtinTools[toolIndex].enabled = enabled;
        }
      }),

    addOrUpdateSubAgent: (subAgent: SubAgentConfig, originalName?: string) =>
      set((state) => {
        const existingIndex = state.subAgents.findIndex(
          (s) => s.name === (originalName || subAgent.name)
        );

        if (existingIndex >= 0) {
          // 更新现有SubAgent
          state.subAgents[existingIndex] = subAgent;
        } else {
          // 添加新SubAgent
          state.subAgents.push(subAgent);
        }
      }),

    removeSubAgent: (subAgentName: string) =>
      set((state) => {
        state.subAgents = state.subAgents.filter((s) => s.name !== subAgentName);
      }),

    reorderSubAgents: (newSubAgents: SubAgentConfig[]) =>
      set((state) => {
        state.subAgents = newSubAgents;
      }),

    setAllData: (data: SettingsStateData) =>
      set((state) => {
        const builtinTools = data.builtinTools || [...getDefaultBuiltinTools()];
        // 合并默认工具，确保新添加的默认工具也被包含
        for (const builtinTool of getDefaultBuiltinTools()) {
          const existingBuiltinTool = builtinTools.find((bt) => bt.name === builtinTool.name);
          if (!existingBuiltinTool) {
            builtinTools.push(builtinTool);
          }
        }
        state.models = data.models || [];
        state.defaultAgentModel = data.defaultAgentModel || null;
        state.titleModel = data.titleModel || null;
        state.mcpServers = data.mcpServers || [];
        state.builtinTools = builtinTools;
        state.subAgents = data.subAgents || [];
      }),
  }))
);

// 保留向后兼容的单例 API（用于非 React 代码）
export const settingsStore = {
  getState: () => useSettingsStore.getState(),
  setState: useSettingsStore.setState,
  subscribe: useSettingsStore.subscribe,
  reset: () => useSettingsStore.setState(initialState),
};
