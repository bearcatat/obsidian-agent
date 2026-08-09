import { ModelConfig, ModelVariant, MCPServerConfig, BuiltinToolConfig, ExaSearchConfig, BochaSearchConfig, BashPermissionConfig, TelegramFeedbackConfig, createDefaultTelegramFeedbackConfig, MemorySettings, createDefaultMemorySettings } from '../types';
import { getDefaultBuiltinTools } from '../tool/BuiltinTools';

export interface ISettingsState {
  readonly models: ModelConfig[];
  readonly defaultAgentModel: ModelConfig | null;
  readonly defaultAgentModelVariant: ModelVariant | null;
  readonly titleModel: ModelConfig | null;
  readonly titleModelVariant: ModelVariant | null;
  readonly imageModel: ModelConfig | null;
  readonly imageModelVariant: ModelVariant | null;
  readonly mcpServers: MCPServerConfig[];
  readonly builtinTools: BuiltinToolConfig[];
  readonly exaSearchConfig: ExaSearchConfig;
  readonly bochaSearchConfig: BochaSearchConfig;
  readonly telegramFeedbackConfig: TelegramFeedbackConfig;
  readonly bashPermissions: BashPermissionConfig;
  readonly memorySettings: MemorySettings;
}

export function clone(settingsState: ISettingsState): ISettingsState {
  return {
    models: settingsState.models || [],
    defaultAgentModel: settingsState.defaultAgentModel,
    defaultAgentModelVariant: settingsState.defaultAgentModelVariant ?? null,
    titleModel: settingsState.titleModel,
    titleModelVariant: settingsState.titleModelVariant ?? null,
    imageModel: settingsState.imageModel ?? null,
    imageModelVariant: settingsState.imageModelVariant ?? null,
    mcpServers: settingsState.mcpServers || [],
    builtinTools: settingsState.builtinTools,
    exaSearchConfig: settingsState.exaSearchConfig || { apiKey: "", enabled: false },
    bochaSearchConfig: settingsState.bochaSearchConfig || { apiKey: "", enabled: false },
    telegramFeedbackConfig: settingsState.telegramFeedbackConfig || createDefaultTelegramFeedbackConfig(),
    bashPermissions: settingsState.bashPermissions || { default: "ask", rules: [] },
    memorySettings: settingsState.memorySettings || createDefaultMemorySettings(),
  };
}

export interface SettingsStateData {
  models: ModelConfig[];
  defaultAgentModel: ModelConfig | null;
  defaultAgentModelVariant: ModelVariant | null;
  titleModel: ModelConfig | null;
  titleModelVariant: ModelVariant | null;
  imageModel: ModelConfig | null;
  imageModelVariant: ModelVariant | null;
  mcpServers: MCPServerConfig[];
  builtinTools: BuiltinToolConfig[];
  exaSearchConfig: ExaSearchConfig;
  bochaSearchConfig: BochaSearchConfig;
  telegramFeedbackConfig: TelegramFeedbackConfig;
  bashPermissions: BashPermissionConfig;
  memorySettings: MemorySettings;
}
