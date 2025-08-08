import { ModelConfig } from '../types';

export interface ISettingsState {
  // 只保留状态属性
  readonly models: ModelConfig[];
  readonly bochaaiApiKey: string;
}

export function clone(settingsState: ISettingsState): ISettingsState {
  return {
    models: settingsState.models,
    bochaaiApiKey: settingsState.bochaaiApiKey,
  };
}

// 状态数据接口
export interface SettingsStateData {
  models: ModelConfig[];
  bochaaiApiKey: string;
}
