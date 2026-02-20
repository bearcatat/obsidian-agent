import { ModelConfig, MCPServerConfig, BuiltinToolConfig, SubAgentConfig, ExaSearchConfig, BochaSearchConfig } from '../types';
import { getDefaultBuiltinTools } from '../tool-ai/BuiltinTools';

export interface ISettingsState {
  // 只保留状态属性
  readonly models: ModelConfig[];
  readonly defaultAgentModel: ModelConfig | null;
  readonly titleModel: ModelConfig | null;
  readonly mcpServers: MCPServerConfig[];
  readonly builtinTools: BuiltinToolConfig[];
  readonly subAgents: SubAgentConfig[];
  readonly exaSearchConfig: ExaSearchConfig;
  readonly bochaSearchConfig: BochaSearchConfig;
}

export function clone(settingsState: ISettingsState): ISettingsState {
  return {
    models: settingsState.models || [],
    defaultAgentModel: settingsState.defaultAgentModel,
    titleModel: settingsState.titleModel,
    mcpServers: settingsState.mcpServers || [],
    builtinTools: settingsState.builtinTools,
    subAgents: settingsState.subAgents || [],
    exaSearchConfig: settingsState.exaSearchConfig || { apiKey: "", enabled: false },
    bochaSearchConfig: settingsState.bochaSearchConfig || { apiKey: "", enabled: false },
  };
}

// 状态数据接口
export interface SettingsStateData {
  models: ModelConfig[];
  defaultAgentModel: ModelConfig | null;
  titleModel: ModelConfig | null;
  mcpServers: MCPServerConfig[];
  builtinTools: BuiltinToolConfig[];
  subAgents: SubAgentConfig[];
  exaSearchConfig: ExaSearchConfig;
  bochaSearchConfig: BochaSearchConfig;
}
