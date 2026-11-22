import type { ModelConfig } from '@/types';
import { isOfficialDeepSeek } from './official-model-selection';

export function isOfficialDeepSeekAuthError(error: unknown, model: ModelConfig | null | undefined): boolean {
  if (!isOfficialDeepSeek(model)) return false;
  const status = (error as { status?: unknown })?.status;
  return status === 401 || status === 403 || /\b(401|403)\b/.test(String(error));
}
