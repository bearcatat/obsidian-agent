import { ModelConfig, MCPServerConfig, BuiltinToolConfig, SubAgentConfig } from '../types';
import { getDefaultBuiltinTools } from '../tool-ai/BuiltinTools';

export interface ISettingsState {
  // 只保留状态属性
  readonly models: ModelConfig[];
  readonly defaultAgentModel: ModelConfig | null;
  readonly titleModel: ModelConfig | null;
  readonly mcpServers: MCPServerConfig[];
  readonly builtinTools: BuiltinToolConfig[];
  readonly subAgents: SubAgentConfig[];
}

export function clone(settingsState: ISettingsState): ISettingsState {
  return {
    models: settingsState.models || [],
    defaultAgentModel: settingsState.defaultAgentModel,
    titleModel: settingsState.titleModel,
    mcpServers: settingsState.mcpServers || [],
    builtinTools: settingsState.builtinTools,
    subAgents: settingsState.subAgents || [],
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
}
