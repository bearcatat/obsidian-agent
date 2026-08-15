import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { assertValidModelIdentity, ModelConfig, ModelVariant, MCPServerConfig, BuiltinToolConfig, ExaSearchConfig, BochaSearchConfig, BashPermissionConfig, TelegramFeedbackConfig, createDefaultTelegramFeedbackConfig, MemorySettings, createDefaultMemorySettings, normalizeMemoryIdleHours, resolveModelVariant } from '../types';
import { cloneDefaultBashPermissions, getDefaultBuiltinTools, normalizeBashPermissionConfig, normalizeBuiltinTools } from '../tool/BuiltinTools';
import AIModelManager from '../llm/ModelManager';
import { SettingsStateData } from './settings-state';

interface SettingsStore extends SettingsStateData {
  addOrUpdateModel: (model: ModelConfig, originalId?: string) => void;
  removeModel: (modelId: string) => void;
  reorderModels: (newModels: ModelConfig[]) => void;
  setDefaultAgentModel: (model: ModelConfig | null, variant: ModelVariant | null) => void;
  setTitleModel: (model: ModelConfig | null, variant: ModelVariant | null) => void;
  setImageModel: (model: ModelConfig | null, variant: ModelVariant | null) => void;
  setAutoContextCompaction: (enabled: boolean) => void;
  addOrUpdateMCPServer: (server: MCPServerConfig, originalName?: string) => void;
  removeMCPServer: (serverName: string) => void;
  reorderMCPServers: (newServers: MCPServerConfig[]) => void;

  updateBuiltinTool: (toolName: string, enabled: boolean) => void;

  setExaSearchConfig: (config: ExaSearchConfig) => void;
  updateExaSearchEnabled: (enabled: boolean) => void;

  setBochaSearchConfig: (config: BochaSearchConfig) => void;
  updateBochaSearchEnabled: (enabled: boolean) => void;

  setTelegramFeedbackConfig: (config: TelegramFeedbackConfig) => void;
  updateTelegramFeedbackEnabled: (enabled: boolean) => void;

  setBashPermissions: (config: BashPermissionConfig) => void;
  setMemorySettings: (config: MemorySettings) => void;

  setAllData: (data: Partial<SettingsStateData>) => void;
}

const initialState: SettingsStateData = {
  models: [],
  defaultAgentModel: null,
  defaultAgentModelVariant: null,
  titleModel: null,
  titleModelVariant: null,
  imageModel: null,
  imageModelVariant: null,
  autoContextCompaction: true,
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
  telegramFeedbackConfig: createDefaultTelegramFeedbackConfig(),
  bashPermissions: cloneDefaultBashPermissions(),
  memorySettings: createDefaultMemorySettings(),
};

export const useSettingsStore = create<SettingsStore>()(
  immer((set) => ({
    ...initialState,

    addOrUpdateModel: (model: ModelConfig, originalId?: string) =>
      set((state) => {
        assertValidModelIdentity(model);
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
          state.defaultAgentModelVariant = resolveModelVariant(model, state.defaultAgentModelVariant);
          modelManager.setAgent(model, state.defaultAgentModelVariant);
          if (!state.titleModel) {
            state.titleModelVariant = null;
            modelManager.setTitle(model, null);
          }
        }

        // Check if this model is the title model
        if (state.titleModel?.id === targetId) {
          state.titleModel = model;
          state.titleModelVariant = null;
          modelManager.setTitle(model, null);
        }

        // Check if this model is the image model
        if (state.imageModel?.id === targetId) {
          state.imageModel = model;
          state.imageModelVariant = null;
        }
      }),

    removeModel: (modelId: string) =>
      set((state) => {
        state.models = state.models.filter((model) => model.id !== modelId);

        // 如果删除的模型是默认模型或标题模型，则清空对应设置
        if (state.defaultAgentModel?.id === modelId) {
          state.defaultAgentModel = null;
          state.defaultAgentModelVariant = null;
        }
        if (state.titleModel?.id === modelId) {
          state.titleModel = null;
          state.titleModelVariant = null;
        }
        if (state.imageModel?.id === modelId) {
          state.imageModel = null;
          state.imageModelVariant = null;
        }
      }),

    reorderModels: (newModels: ModelConfig[]) =>
      set((state) => {
        state.models = newModels;
      }),

    setDefaultAgentModel: (model: ModelConfig | null, variant: ModelVariant | null) =>
      set((state) => {
        state.defaultAgentModel = model;
        state.defaultAgentModelVariant = variant;
      }),

    setTitleModel: (model: ModelConfig | null, variant: ModelVariant | null) =>
      set((state) => {
        state.titleModel = model;
        state.titleModelVariant = null;
      }),

    setImageModel: (model: ModelConfig | null, variant: ModelVariant | null) =>
      set((state) => {
        state.imageModel = model;
        state.imageModelVariant = null;
      }),

    setAutoContextCompaction: (enabled: boolean) =>
      set((state) => {
        state.autoContextCompaction = enabled;
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

    setTelegramFeedbackConfig: (config: TelegramFeedbackConfig) =>
      set((state) => {
        state.telegramFeedbackConfig = config;
      }),

    updateTelegramFeedbackEnabled: (enabled: boolean) =>
      set((state) => {
        state.telegramFeedbackConfig.enabled = enabled;
      }),

    setBashPermissions: (config: BashPermissionConfig) =>
      set((state) => {
        state.bashPermissions = config;
      }),

    setMemorySettings: (config: MemorySettings) =>
      set((state) => {
        state.memorySettings = config;
      }),

    setAllData: (data: SettingsStateData) =>
      set((state) => {
        state.models = data.models || [];
        state.defaultAgentModel = data.defaultAgentModel || null;
        state.defaultAgentModelVariant = data.defaultAgentModelVariant ?? null;
        state.titleModel = data.titleModel || null;
        state.titleModelVariant = null;
        state.imageModel = data.imageModel || null;
        state.imageModelVariant = null;
        state.autoContextCompaction = data.autoContextCompaction ?? true;
        state.mcpServers = data.mcpServers || [];
        state.builtinTools = normalizeBuiltinTools(data.builtinTools);
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
        state.telegramFeedbackConfig = data.telegramFeedbackConfig || createDefaultTelegramFeedbackConfig();
        state.bashPermissions = normalizeBashPermissionConfig(data.bashPermissions);
        const savedMemorySettings = { ...(data.memorySettings || {}) } as Partial<MemorySettings> & {
          startupBatchLimit?: number;
          useMemories?: boolean;
          generateMemories?: boolean;
        };
        delete savedMemorySettings.startupBatchLimit;
        delete savedMemorySettings.useMemories;
        delete savedMemorySettings.generateMemories;
        state.memorySettings = {
          ...createDefaultMemorySettings(),
          ...savedMemorySettings,
          idleHours: normalizeMemoryIdleHours(savedMemorySettings.idleHours ?? createDefaultMemorySettings().idleHours),
        };
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
