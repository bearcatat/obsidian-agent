import type { ModelConfig } from '@/types';

/** Official catalog entries are shown first; user order is otherwise untouched. */
export function selectableModels(official: ModelConfig[], user: ModelConfig[]): ModelConfig[] {
  return [...official, ...user];
}
