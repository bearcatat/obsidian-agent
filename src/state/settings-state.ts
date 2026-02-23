import { ModelConfig, MCPServerConfig, BuiltinToolConfig, ExaSearchConfig, BochaSearchConfig, BashPermissionConfig } from '../types';
import { getDefaultBuiltinTools } from '../tool-ai/BuiltinTools';

export interface ISettingsState {
  readonly models: ModelConfig[];
  readonly defaultAgentModel: ModelConfig | null;
  readonly titleModel: ModelConfig | null;
  readonly mcpServers: MCPServerConfig[];
  readonly builtinTools: BuiltinToolConfig[];
  readonly exaSearchConfig: ExaSearchConfig;
  readonly bochaSearchConfig: BochaSearchConfig;
  readonly bashPermissions: BashPermissionConfig;
}

export function clone(settingsState: ISettingsState): ISettingsState {
  return {
    models: settingsState.models || [],
    defaultAgentModel: settingsState.defaultAgentModel,
    titleModel: settingsState.titleModel,
    mcpServers: settingsState.mcpServers || [],
    builtinTools: settingsState.builtinTools,
    exaSearchConfig: settingsState.exaSearchConfig || { apiKey: "", enabled: false },
    bochaSearchConfig: settingsState.bochaSearchConfig || { apiKey: "", enabled: false },
    bashPermissions: settingsState.bashPermissions || { default: "ask", rules: [] },
  };
}

export interface SettingsStateData {
  models: ModelConfig[];
  defaultAgentModel: ModelConfig | null;
  titleModel: ModelConfig | null;
  mcpServers: MCPServerConfig[];
  builtinTools: BuiltinToolConfig[];
  exaSearchConfig: ExaSearchConfig;
  bochaSearchConfig: BochaSearchConfig;
  bashPermissions: BashPermissionConfig;
}
