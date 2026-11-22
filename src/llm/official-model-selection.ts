import type { ModelConfig } from '@/types';

export function isOfficialDeepSeek(model: ModelConfig | null | undefined): boolean {
  return model?.source === 'official' && model.provider === 'deepseek';
}

export function clearHiddenOfficialDeepSeekModel(model: ModelConfig | null | undefined): ModelConfig | null {
  return isOfficialDeepSeek(model) ? null : model ?? null;
}

export function clearOfficialDeepSeekSelections<T extends { current: ModelConfig | null; defaultModel: ModelConfig | null; title: ModelConfig | null; image: ModelConfig | null }>(selections: T) {
  return {
    current: clearHiddenOfficialDeepSeekModel(selections.current),
    defaultModel: clearHiddenOfficialDeepSeekModel(selections.defaultModel),
    title: clearHiddenOfficialDeepSeekModel(selections.title),
    image: clearHiddenOfficialDeepSeekModel(selections.image),
  };
}
