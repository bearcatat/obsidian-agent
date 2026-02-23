import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ModelConfig, MCPServerConfig, BuiltinToolConfig, ExaSearchConfig, BochaSearchConfig, BashPermissionConfig } from '../types';
import { getDefaultBuiltinTools } from '../tool-ai/BuiltinTools';
import AIModelManager from '../llm-ai/ModelManager';
import { SettingsStateData } from './settings-state';

interface SettingsStore extends SettingsStateData {
  addOrUpdateModel: (model: ModelConfig, originalId?: string) => void;
  removeModel: (modelId: string) => void;
  reorderModels: (newModels: ModelConfig[]) => void;
  setDefaultAgentModel: (model: ModelConfig | null) => void;
  setTitleModel: (model: ModelConfig | null) => void;

  addOrUpdateMCPServer: (server: MCPServerConfig, originalName?: string) => void;
  removeMCPServer: (serverName: string) => void;
  reorderMCPServers: (newServers: MCPServerConfig[]) => void;

  updateBuiltinTool: (toolName: string, enabled: boolean) => void;

  setExaSearchConfig: (config: ExaSearchConfig) => void;
  updateExaSearchEnabled: (enabled: boolean) => void;

  setBochaSearchConfig: (config: BochaSearchConfig) => void;
  updateBochaSearchEnabled: (enabled: boolean) => void;

  setBashPermissions: (config: BashPermissionConfig) => void;

  setAllData: (data: SettingsStateData) => void;
}

const initialState: SettingsStateData = {
  models: [],
  defaultAgentModel: null,
  titleModel: null,
  mcpServers: [],
  builtinTools: getDefaultBuiltinTools(),
  exaSearchConfig: {
    apiKey: "",
    enabled: false,
    numResults: 10,
    maxCharacters: 3000,
    livecrawl: "fallback",
  },
  bochaSearchConfig: {
    apiKey: "",
    enabled: false,
    count: 10,
    freshness: "noLimit",
  },
  bashPermissions: {
    default: "ask",
    rules: [
      { pattern: "git status*", permission: "allow" },
      { pattern: "git log*", permission: "allow" },
      { pattern: "git diff*", permission: "allow" },
      { pattern: "git *", permission: "ask" },
      { pattern: "npm *", permission: "allow" },
      { pattern: "node *", permission: "allow" },
      { pattern: "pnpm *", permission: "allow" },
      { pattern: "yarn *", permission: "allow" },
      { pattern: "rm *", permission: "deny" },
      { pattern: "del *", permission: "deny" },
      { pattern: "rmdir *", permission: "deny" },
      { pattern: "format *", permission: "deny" },
    ],
  },
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

    setExaSearchConfig: (config: ExaSearchConfig) =>
      set((state) => {
        state.exaSearchConfig = config;
      }),

    updateExaSearchEnabled: (enabled: boolean) =>
      set((state) => {
        state.exaSearchConfig.enabled = enabled;
      }),

    setBochaSearchConfig: (config: BochaSearchConfig) =>
      set((state) => {
        state.bochaSearchConfig = config;
      }),

    updateBochaSearchEnabled: (enabled: boolean) =>
      set((state) => {
        state.bochaSearchConfig.enabled = enabled;
      }),

    setBashPermissions: (config: BashPermissionConfig) =>
      set((state) => {
        state.bashPermissions = config;
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
        state.exaSearchConfig = data.exaSearchConfig || {
          apiKey: "",
          enabled: false,
          numResults: 10,
          maxCharacters: 3000,
          livecrawl: "fallback",
        };
        state.bochaSearchConfig = data.bochaSearchConfig || {
          apiKey: "",
          enabled: false,
          count: 10,
          freshness: "noLimit",
        };
        state.bashPermissions = data.bashPermissions || initialState.bashPermissions;
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
