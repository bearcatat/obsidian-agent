import type { OfficialModelPreset } from '@/types';

export const DEFAULT_DEEPSEEK_PRESETS: OfficialModelPreset[] = [
  { id: 'deepseek-flash', displayName: 'DeepSeek Flash' },
  { id: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro' },
];

export function validateOfficialPresetList(value: unknown): OfficialModelPreset[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Official model catalog must be a non-empty array');
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid official model preset');
    const id = (item as { id?: unknown }).id;
    const displayName = (item as { displayName?: unknown }).displayName;
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(id) || seen.has(id)) throw new Error('Invalid or duplicate official model ID');
    if (typeof displayName !== 'string' || !displayName.trim()) throw new Error('Official model display name is required');
    seen.add(id);
    return { id, displayName: displayName.trim() };
  });
}

/** Override matching IDs while retaining the fixed catalog order. */
export function mergeOfficialPresets(defaults: OfficialModelPreset[], override?: OfficialModelPreset[]): OfficialModelPreset[] {
  if (!override) return defaults.map((item) => ({ ...item }));
  const byId = new Map(override.map((item) => [item.id, item]));
  const merged = defaults.map((item) => ({ ...(byId.get(item.id) ?? item) }));
  for (const item of override) if (!defaults.some((base) => base.id === item.id)) merged.push({ ...item });
  return merged;
}
