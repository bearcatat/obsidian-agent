export type SupportedLocale = 'en-US' | 'zh-CN';

export interface HostLocaleModule {
  getLanguage?: unknown;
}

/**
 * Normalize the only supported host-language input into the plugin UI locale.
 * The caller is responsible for passing the public Obsidian module only.
 */
export function normalizeHostLocale(value: unknown): SupportedLocale {
  if (typeof value !== 'string') return 'en-US';

  const normalized = value.trim().toLowerCase();
  if (normalized === 'zh' || /^zh(?:-[a-z0-9]+)+$/.test(normalized)) return 'zh-CN';
  return 'en-US';
}

/**
 * Read Obsidian's public getLanguage() API. Missing, invalid, or throwing
 * host APIs intentionally fall back to English for older Obsidian versions.
 */
export function resolveHostLocale(host: HostLocaleModule | null | undefined): SupportedLocale {
  const getLanguage = host?.getLanguage;
  if (typeof getLanguage !== 'function') return 'en-US';

  try {
    return normalizeHostLocale((getLanguage as () => unknown)());
  } catch {
    return 'en-US';
  }
}
