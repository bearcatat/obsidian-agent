import { ModelConfig } from '@/types';
import { DisplayName } from '../ModelConfigField/DisplayName';
import { ModelName } from '../ModelConfigField/ModelName';
import { BaseUrl } from '../ModelConfigField/BaseURL';
import { FormField } from '@/ui/elements/form-field';
import { Input } from '@/ui/elements/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/elements/select';
import { Provider } from '../ModelConfigField/Provider';
import { ContextWindow } from '../ModelConfigField/ContextWindow';
import { SettingSwitch } from '@/ui/elements/setting-switch';
import { t } from '@/i18n';

interface CommonModelConfigProps {
  model: ModelConfig;
  setModel: (model: ModelConfig) => void;
  dialogElement: HTMLDivElement | null;
  secretIds: string[];
  secretChoice: string;
  setSecretChoice: (value: string) => void;
  newSecretId: string;
  setNewSecretId: (value: string) => void;
  newSecretValue: string;
  setNewSecretValue: (value: string) => void;
}

export const NEW_SECRET_VALUE = '@new';

export const CommonModelConfig = ({
  model, setModel, dialogElement, secretIds, secretChoice, setSecretChoice,
  newSecretId, setNewSecretId, newSecretValue, setNewSecretValue,
}: CommonModelConfigProps) => {
  const customConnection = model.connectionMode === 'custom' || (!model.connectionMode && Boolean(model.baseUrl));
  const hasProviderSecret = model.provider === 'deepseek' && model.connectionMode === 'official';

  const setCustomConnection = (checked: boolean) => {
    setModel({ ...model, connectionMode: checked ? 'custom' : 'official', credentialRef: checked ? model.credentialRef : undefined });
    if (!checked) setSecretChoice('');
  };

  const onSecretChoiceChange = (value: string) => {
    setSecretChoice(value);
    setModel({ ...model, credentialRef: value && value !== NEW_SECRET_VALUE && value !== '__none__' ? value : undefined });
  };

  return <div className="tw-space-y-3">
    <DisplayName model={model} setModel={setModel} />
    <ModelName model={model} setModel={setModel} />
    <Provider model={model} setModel={setModel} dialogElement={dialogElement} />
    <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-py-1">
      <div>
        <div className="tw-text-sm tw-font-medium">{t('settings:customBaseUrl')}</div>
        <div className="tw-text-xs tw-text-muted">{customConnection ? t('settings:customConnectionHint') : hasProviderSecret ? t('settings:officialConnectionHint') : t('settings:officialConnectionKeyMissingHint')}</div>
      </div>
      <SettingSwitch checked={customConnection} onCheckedChange={setCustomConnection} />
    </div>
    {customConnection && <>
      <BaseUrl model={model} setModel={setModel} />
      <FormField label={t('settings:customConnectionSecret')}>
        <Select value={secretChoice} onValueChange={onSecretChoiceChange}>
          <SelectTrigger><SelectValue placeholder={t('settings:selectExistingSecret')} /></SelectTrigger>
          <SelectContent container={dialogElement}>
            <SelectItem value="__none__">{t('settings:selectExistingSecret')}</SelectItem>
            {secretIds.map((id) => <SelectItem key={id} value={id}>{id}</SelectItem>)}
            <SelectItem value={NEW_SECRET_VALUE}>{t('settings:createNewSecret')}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {secretChoice === NEW_SECRET_VALUE && <>
        <FormField label={t('settings:newSecretName')}>
          <Input value={newSecretId} placeholder={t('settings:newSecretNamePlaceholder')} onChange={(event) => setNewSecretId(event.target.value)} />
        </FormField>
        <FormField label={t('settings:newSecretValue')}>
          <Input type="password" value={newSecretValue} onChange={(event) => setNewSecretValue(event.target.value)} placeholder={t('settings:secretValuePlaceholder')} />
        </FormField>
      </>}
    </>}
    {model.apiKey && <div className="tw-text-xs tw-text-warning">{t('settings:legacyApiKeyDescription')}</div>}
    <ContextWindow model={model} setModel={setModel} />
  </div>;
};
