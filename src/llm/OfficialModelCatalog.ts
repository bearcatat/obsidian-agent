import { Notice, type App } from 'obsidian';
import { t } from '@/i18n';
import type { ModelConfig, OfficialModelCatalogCache, OfficialModelPreset } from '@/types';
import { DEFAULT_DEEPSEEK_PRESETS, mergeOfficialPresets, validateOfficialPresetList } from './official-model-utils';

export const DEEPSEEK_SECRET_ID = 'obsidian-agent-deepseek';
export const DEEPSEEK_OVERRIDE_PATH = 'obsidian-agent/providers/deepseek.json';

const OVERRIDE_ERROR_NOTICE_DURATION_MS = 15_000;

export class OfficialModelCatalog {
  private presets: OfficialModelPreset[];
  private readonly listeners = new Set<() => void>();
  private reportedOverrideError = false;

  constructor(private readonly app: App, cache?: OfficialModelCatalogCache) {
    this.presets = cache?.version === 1 && cache.provider === 'deepseek'
      ? validateOfficialPresetList(cache.models)
      : DEFAULT_DEEPSEEK_PRESETS;
  }

  getCache(): OfficialModelCatalogCache {
    return { version: 1, provider: 'deepseek', models: this.presets.map((model) => ({ ...model })) };
  }

  getModels(): ModelConfig[] {
    if (!this.app.secretStorage.getSecret(DEEPSEEK_SECRET_ID)) return [];
    return this.presets.map((preset) => ({
      id: `official:deepseek:${preset.id}`,
      name: preset.id,
      displayName: preset.displayName,
      provider: 'deepseek',
      source: 'official',
      connectionMode: 'official',
      credentialRef: DEEPSEEK_SECRET_ID,
    }));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async refresh(): Promise<void> {
    let next = DEFAULT_DEEPSEEK_PRESETS;
    try {
      if (await this.app.vault.adapter.exists(DEEPSEEK_OVERRIDE_PATH)) {
        const parsed = JSON.parse(await this.app.vault.adapter.read(DEEPSEEK_OVERRIDE_PATH)) as { provider?: unknown; models?: unknown };
        if (parsed.provider !== 'deepseek') throw new Error('provider must be deepseek');
        next = mergeOfficialPresets(DEFAULT_DEEPSEEK_PRESETS, validateOfficialPresetList(parsed.models));
      }
      this.presets = next;
      this.reportedOverrideError = false;
    } catch (error) {
      console.warn(`[OfficialModelCatalog] Ignoring invalid ${DEEPSEEK_OVERRIDE_PATH}:`, error);
      if (!this.reportedOverrideError) {
        this.reportedOverrideError = true;
        new Notice(t('settings:officialCatalogInvalid', { path: DEEPSEEK_OVERRIDE_PATH }), OVERRIDE_ERROR_NOTICE_DURATION_MS);
      }
      // Keep the in-memory/persisted last-known-good catalog.
    }
    this.listeners.forEach((listener) => listener());
  }
}
