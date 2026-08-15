import { useState, useCallback, useEffect } from "react";
import { Button } from "@/ui/elements/button";
import { Input } from "@/ui/elements/input";
import { Label } from "@/ui/elements/label";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { useSettingsStore } from "@/hooks/use-settings";
import { useShallow } from "zustand/react/shallow";
import { BochaSearchConfig } from "@/types";
import SettingsLogic from "@/logic/settings-logic";
import { ExternalLink, Key, Settings2 } from "lucide-react";
import { Notice } from "obsidian";
import { formatNumber, getErrorMessage, t } from "@/i18n";

interface BochaConfigProps {
  onSave?: () => void;
  dialogElement?: HTMLDivElement | null;
}

export const BochaConfig: React.FC<BochaConfigProps> = ({ onSave, dialogElement }) => {
  const { bochaSearchConfig } = useSettingsStore(
    useShallow((state) => ({
      bochaSearchConfig: state.bochaSearchConfig,
    }))
  );

  const [localConfig, setLocalConfig] = useState<BochaSearchConfig>(bochaSearchConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const settingsLogic = SettingsLogic.getInstance();

  useEffect(() => {
    setLocalConfig(bochaSearchConfig);
  }, [bochaSearchConfig]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await settingsLogic.updateBochaSearchConfig(localConfig);
      new Notice(t("common:saved"), 3000);
      onSave?.();
    } catch (error) {
      console.error("Failed to save Bocha search config:", error);
      new Notice(t("common:saveFailed", {
        operation: t("settings:saveBochaConfig"),
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
          <Label htmlFor="bocha-api-key" className="tw-flex tw-items-center tw-gap-2">
            <Key className="tw-size-4" />
            {t("settings:apiKey")}
          </Label>
          <a
            href="https://open.bochaai.com"
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
            id="bocha-api-key"
            type={showApiKey ? "text" : "password"}
            placeholder={t("settings:bochaApiKeyPlaceholder")}
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
          <Label className="tw-text-base tw-font-medium">{t("settings:enableBocha")}</Label>
          <p className="tw-text-sm tw-text-gray-500">
            {t("settings:allowAgentSearchBocha")}
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
            <Label htmlFor="bocha-count" className="tw-text-sm">
              {t("settings:numberOfResults")}
            </Label>
            <Input
              id="bocha-count"
              type="number"
              min={1}
              max={50}
              value={localConfig.count || 10}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  count: Math.min(50, Math.max(1, parseInt(e.target.value) || 10)),
                }))
              }
            />
            <p className="tw-text-xs tw-text-gray-500">{t("settings:range", { value: `${formatNumber(1)}-${formatNumber(50)}` })}</p>
          </div>

          <div className="tw-space-y-2">
            <Label htmlFor="bocha-freshness" className="tw-text-sm">
              {t("settings:selectTimeRange")}
            </Label>
            <Select
              value={localConfig.freshness || "noLimit"}
              onValueChange={(value) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  freshness: value as BochaSearchConfig["freshness"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("settings:selectTimeRange")} />
              </SelectTrigger>
              <SelectContent container={dialogElement}>
                <SelectItem value="noLimit">{t("settings:noLimit")}</SelectItem>
                <SelectItem value="oneYear">{t("settings:pastYear")}</SelectItem>
                <SelectItem value="oneMonth">{t("settings:pastMonth")}</SelectItem>
                <SelectItem value="oneWeek">{t("settings:pastWeek")}</SelectItem>
                <SelectItem value="oneDay">{t("settings:pastDay")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
