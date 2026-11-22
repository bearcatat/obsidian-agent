import type { ModelConfig } from '@/types';
import { getGlobalApp } from '@/utils';
import { t } from '@/i18n';

const SECRET_ID = /^[a-zA-Z0-9._:-]{1,160}$/;

export function resolveModelCredentials(model: ModelConfig): ModelConfig {
  if (!model.credentialRef) return model;
  const secret = getGlobalApp().secretStorage.getSecret(model.credentialRef);
  if (!secret) throw new Error(t('settings:secretNotFound', { id: model.credentialRef }));
  return { ...model, apiKey: secret };
}

export function writeSecretAndConfirm(secretStorage: { setSecret(id: string, value: string): void; getSecret(id: string): string | null }, id: string, value: string, allowEmpty = false): void {
  if (!SECRET_ID.test(id)) throw new Error(t('settings:invalidSecretStorageKey'));
  if (!allowEmpty && !value.trim()) throw new Error(t('settings:secretCannotBeEmpty'));
  secretStorage.setSecret(id, value);
  if (secretStorage.getSecret(id) !== value) throw new Error(t('settings:secretStorageWriteFailed'));
}
