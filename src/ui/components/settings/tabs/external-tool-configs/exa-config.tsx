import { useState, useCallback, useEffect } from "react";
import { Button } from "@/ui/elements/button";
import { Input } from "@/ui/elements/input";
import { Label } from "@/ui/elements/label";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { useSettingsStore } from "@/hooks/use-settings";
import { useShallow } from "zustand/react/shallow";
import { ExaSearchConfig } from "@/types";
import SettingsLogic from "@/logic/settings-logic";
import { ExternalLink, Key, Settings2 } from "lucide-react";
import { Notice } from "obsidian";
import { formatNumber, getErrorMessage, t } from "@/i18n";

interface ExaConfigProps {
  onSave?: () => void;
  dialogElement?: HTMLDivElement | null;
}

export const ExaConfig: React.FC<ExaConfigProps> = ({ onSave, dialogElement }) => {
  const { exaSearchConfig } = useSettingsStore(
    useShallow((state) => ({
      exaSearchConfig: state.exaSearchConfig,
    }))
  );

  const [localConfig, setLocalConfig] = useState<ExaSearchConfig>(exaSearchConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const settingsLogic = SettingsLogic.getInstance();

  useEffect(() => {
    setLocalConfig(exaSearchConfig);
  }, [exaSearchConfig]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await settingsLogic.updateExaSearchConfig(localConfig);
      new Notice(t("common:saved"), 3000);
      onSave?.();
    } catch (error) {
      console.error("Failed to save Exa search config:", error);
      new Notice(t("common:saveFailed", {
        operation: t("settings:saveExaConfig"),
        cause: getErrorMessage(error),
      }), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [localConfig, settingsLogic, onSave]);

  const isValid = localConfig.apiKey.trim().length > 0;

  return (
    <div className="tw-space-y-6">
      {/* API Key Section */}
      <div className="tw-space-y-2">
        <div className="tw-flex tw-items-center tw-justify-between">
          <Label htmlFor="exa-api-key" className="tw-flex tw-items-center tw-gap-2">
            <Key className="tw-size-4" />
            {t("settings:apiKey")}
          </Label>
          <a
            href="https://dashboard.exa.ai/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-blue-500 hover:tw-text-blue-600 tw-transition-colors"
          >
            {t("common:getApiKey")}
            <ExternalLink className="tw-size-3" />
          </a>
        </div>
        <div className="tw-flex tw-gap-2">
          <Input
            id="exa-api-key"
            type={showApiKey ? "text" : "password"}
            placeholder={t("settings:exaApiKeyPlaceholder")}
            value={localConfig.apiKey}
            onChange={(e) => setLocalConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
            className="tw-flex-1"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            {showApiKey ? t("common:hide") : t("common:show")}
          </Button>
        </div>
      </div>

      {/* Enable/Disable Switch */}
      <div className="tw-flex tw-items-center tw-justify-between tw-p-4 tw-bg-secondary/50 tw-rounded-lg">
        <div className="tw-space-y-1">
          <Label className="tw-text-base tw-font-medium">{t("settings:enableExa")}</Label>
          <p className="tw-text-sm tw-text-gray-500">
            {t("settings:allowAgentSearchExa")}
          </p>
        </div>
        <SettingSwitch
          checked={localConfig.enabled}
          onCheckedChange={(checked) =>
            setLocalConfig((prev) => ({ ...prev, enabled: checked }))
          }
          disabled={!isValid}
        />
      </div>

      {/* Default Parameters */}
      <div className="tw-space-y-4">
        <Label className="tw-flex tw-items-center tw-gap-2">
          <Settings2 className="tw-size-4" />
          {t("settings:defaultParameters")}
        </Label>

        <div className="tw-grid tw-grid-cols-2 tw-gap-4">
          <div className="tw-space-y-2">
            <Label htmlFor="exa-num-results" className="tw-text-sm">
              {t("settings:numberOfResults")}
            </Label>
            <Input
              id="exa-num-results"
              type="number"
              min={1}
              max={20}
              value={localConfig.numResults || 10}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  numResults: Math.min(20, Math.max(1, parseInt(e.target.value) || 10)),
                }))
              }
            />
            <p className="tw-text-xs tw-text-gray-500">{t("settings:range", { value: `${formatNumber(1)}-${formatNumber(20)}` })}</p>
          </div>

          <div className="tw-space-y-2">
            <Label htmlFor="exa-max-chars" className="tw-text-sm">
              {t("settings:maxCharacters")}
            </Label>
            <Input
              id="exa-max-chars"
              type="number"
              min={500}
              max={10000}
              step={500}
              value={localConfig.maxCharacters || 3000}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  maxCharacters: Math.min(10000, Math.max(500, parseInt(e.target.value) || 3000)),
                }))
              }
            />
            <p className="tw-text-xs tw-text-gray-500">{t("settings:range", { value: `${formatNumber(500)}-${formatNumber(10000)}` })}</p>
          </div>
        </div>

        <div className="tw-space-y-2">
          <Label htmlFor="exa-livecrawl" className="tw-text-sm">
            {t("settings:selectLivecrawlMode")}
          </Label>
          <Select
            value={localConfig.livecrawl || "fallback"}
            onValueChange={(value) =>
              setLocalConfig((prev) => ({
                ...prev,
                livecrawl: value as ExaSearchConfig["livecrawl"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("settings:selectLivecrawlMode")} />
            </SelectTrigger>
            <SelectContent container={dialogElement}>
              <SelectItem value="never">{t("settings:cachedOnly")}</SelectItem>
              <SelectItem value="fallback">{t("settings:liveFallback")}</SelectItem>
              <SelectItem value="always">{t("settings:alwaysFresh")}</SelectItem>
              <SelectItem value="preferred">{t("settings:preferredLive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Save Button */}
      <div className="tw-flex tw-justify-end tw-pt-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? t("common:saving") : t("common:saveChanges")}
        </Button>
      </div>
    </div>
  );
};
