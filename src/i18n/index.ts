import type { TOptions } from 'i18next';
import { getCurrentLocale, i18n, initI18n } from './instance';
import { resolveHostLocale, type HostLocaleModule, type SupportedLocale } from './host-locale';

export { initI18n } from './instance';
export { normalizeHostLocale, resolveHostLocale } from './host-locale';
export { getResourceKeys, resources, NAMESPACES } from './resources';
export type { HostLocaleModule, SupportedLocale };

export function t(key: string, options?: TOptions): string {
  return i18n.t(key, options);
}

export function getUiLocale(): SupportedLocale {
  return getCurrentLocale();
}

export function formatDateTime(
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(getUiLocale(), options).format(date);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getUiLocale(), options).format(value);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return t('common:unknownError');
}

const BUILTIN_TOOL_DESCRIPTION_KEYS: Record<string, string> = {
  readNoteByPath: 'settings:builtinToolReadNoteByPath',
  readNoteByLink: 'settings:builtinToolReadNoteByLink',
  askQuestion: 'settings:builtinToolAskQuestion',
  editFile: 'settings:builtinToolEditFile',
  write: 'settings:builtinToolWrite',
  moveNote: 'settings:builtinToolMoveNote',
  webFetch: 'settings:builtinToolWebFetch',
  search: 'settings:builtinToolSearch',
  list: 'settings:builtinToolList',
  skill: 'settings:builtinToolSkill',
  bash: 'settings:builtinToolBash',
};

export function getBuiltinToolDisplayDescription(toolName: string, fallbackDescription: string): string {
  const key = BUILTIN_TOOL_DESCRIPTION_KEYS[toolName];
  return key ? t(key) : fallbackDescription;
}
