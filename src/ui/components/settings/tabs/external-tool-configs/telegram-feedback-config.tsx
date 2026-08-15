import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/ui/elements/button";
import { Input } from "@/ui/elements/input";
import { Label } from "@/ui/elements/label";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { useSettingsStore } from "@/hooks/use-settings";
import { useShallow } from "zustand/react/shallow";
import { TelegramFeedbackConfig as TelegramFeedbackConfigType } from "@/types";
import SettingsLogic from "@/logic/settings-logic";
import { Key, Link2, MessageSquareMore, ShieldCheck } from "lucide-react";
import { Notice } from "obsidian";
import { formatDateTime, getErrorMessage, t } from "@/i18n";

interface TelegramFeedbackConfigProps {
  onSave?: () => void;
  dialogElement?: HTMLDivElement | null;
}

export const TelegramFeedbackConfig: React.FC<TelegramFeedbackConfigProps> = ({ onSave }) => {
  const { telegramFeedbackConfig } = useSettingsStore(
    useShallow((state) => ({
      telegramFeedbackConfig: state.telegramFeedbackConfig,
    })),
  );

  const [localConfig, setLocalConfig] = useState<TelegramFeedbackConfigType>(telegramFeedbackConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const settingsLogic = SettingsLogic.getInstance();

  useEffect(() => {
    setLocalConfig(telegramFeedbackConfig);
  }, [telegramFeedbackConfig]);

  const bindingStatus = useMemo(() => {
    if (localConfig.boundUserId && localConfig.boundChatId) {
      return t("settings:boundTo", {
        username: localConfig.boundUsername || "unknown",
        firstName: localConfig.boundFirstName || t("settings:telegramUser"),
      });
    }

    if (localConfig.verificationCode && localConfig.verificationExpiresAt) {
      return t("settings:pendingVerification", {
        code: localConfig.verificationCode,
        date: formatDateTime(localConfig.verificationExpiresAt),
      });
    }

    return t("settings:notBound");
  }, [localConfig]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await settingsLogic.updateTelegramFeedbackConfig(localConfig);
      new Notice(t("common:saved"), 3000);
      onSave?.();
    } catch (error) {
      console.error("Failed to save Telegram feedback config:", error);
      new Notice(t("common:saveFailed", {
        operation: t("settings:saveTelegramConfig"),
        cause: getErrorMessage(error),
      }), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [localConfig, onSave, settingsLogic]);

  const handleGenerateCode = useCallback(async () => {
    setIsSaving(true);
    try {
      const nextConfig = await settingsLogic.generateTelegramVerificationCode(localConfig);
      setLocalConfig(nextConfig);
      new Notice("Telegram verification code generated.", 3000);
    } catch (error) {
      console.error("Failed to generate Telegram verification code:", error);
      new Notice(t("settings:telegramActionFailed", {
        action: t("settings:generateVerificationCode"),
        cause: getErrorMessage(error),
      }), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [localConfig, settingsLogic]);

  const handleClearCode = useCallback(async () => {
    setIsSaving(true);
    try {
      const nextConfig = await settingsLogic.clearTelegramVerificationCode(localConfig);
      setLocalConfig(nextConfig);
      new Notice("Telegram verification code cleared.", 3000);
    } catch (error) {
      console.error("Failed to clear Telegram verification code:", error);
      new Notice(t("settings:telegramActionFailed", {
        action: t("settings:clearCode"),
        cause: getErrorMessage(error),
      }), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [localConfig, settingsLogic]);

  const handleUnbind = useCallback(async () => {
    setIsSaving(true);
    try {
      const nextConfig = await settingsLogic.clearTelegramBinding(localConfig);
      setLocalConfig(nextConfig);
      new Notice("Telegram user binding cleared.", 3000);
    } catch (error) {
      console.error("Failed to clear Telegram binding:", error);
      new Notice(t("settings:telegramActionFailed", {
        action: t("settings:unbindUser"),
        cause: getErrorMessage(error),
      }), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [localConfig, settingsLogic]);

  const isConfigured = localConfig.botToken.trim().length > 0;

  return (
    <div className="tw-space-y-6">
      <div className="tw-space-y-2">
        <div className="tw-flex tw-items-center tw-justify-between">
          <Label htmlFor="telegram-bot-token" className="tw-flex tw-items-center tw-gap-2">
            <Key className="tw-size-4" />
            {t("settings:botToken")}
          </Label>
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="tw-text-sm tw-text-blue-500 hover:tw-text-blue-600 tw-transition-colors"
          >
            {t("common:getToken")}
          </a>
        </div>
        <div className="tw-flex tw-gap-2">
          <Input
            id="telegram-bot-token"
            type={showToken ? "text" : "password"}
            placeholder={t("settings:telegramTokenPlaceholder")}
            value={localConfig.botToken}
            onChange={(event) => setLocalConfig((prev) => ({ ...prev, botToken: event.target.value }))}
            className="tw-flex-1"
          />
          <Button variant="secondary" size="sm" onClick={() => setShowToken((prev) => !prev)}>
            {showToken ? t("common:hide") : t("common:show")}
          </Button>
        </div>
      </div>

      <div className="tw-space-y-2">
        <Label htmlFor="telegram-proxy-url" className="tw-flex tw-items-center tw-gap-2">
          <Link2 className="tw-size-4" />
          {t("settings:proxyUrl")}
        </Label>
        <Input
          id="telegram-proxy-url"
          placeholder="http://127.0.0.1:7890 or socks5://127.0.0.1:1080"
          value={localConfig.proxyUrl}
          onChange={(event) => setLocalConfig((prev) => ({ ...prev, proxyUrl: event.target.value }))}
        />
        <p className="tw-text-xs tw-text-gray-500">{t("settings:supportsProxy")}</p>
      </div>

      <div className="tw-flex tw-items-center tw-justify-between tw-p-4 tw-bg-secondary/50 tw-rounded-lg">
        <div className="tw-space-y-1">
          <Label className="tw-text-base tw-font-medium">{t("settings:enableTelegram")}</Label>
          <p className="tw-text-sm tw-text-gray-500">{t("settings:telegramRuntimeDescription")}</p>
        </div>
        <SettingSwitch
          checked={localConfig.enabled}
          onCheckedChange={(checked) => setLocalConfig((prev) => ({ ...prev, enabled: checked }))}
          disabled={!isConfigured}
        />
      </div>

      <div className="tw-space-y-2">
        <Label htmlFor="telegram-polling-timeout">{t("settings:pollingTimeout")}</Label>
        <Input
          id="telegram-polling-timeout"
          type="number"
          min={5}
          max={60}
          value={localConfig.pollingTimeoutSeconds}
          onChange={(event) =>
            setLocalConfig((prev) => ({
              ...prev,
              pollingTimeoutSeconds: Math.min(60, Math.max(5, parseInt(event.target.value, 10) || 15)),
            }))
          }
        />
      </div>

      <div className="tw-space-y-3 tw-rounded-lg tw-border tw-p-4">
        <div className="tw-flex tw-items-center tw-gap-2 tw-font-medium">
          <ShieldCheck className="tw-size-4" />
          {t("settings:userBinding")}
        </div>
        <p className="tw-text-sm tw-text-gray-600">{bindingStatus}</p>
        <div className="tw-flex tw-flex-wrap tw-gap-2">
          <Button variant="secondary" onClick={handleGenerateCode} disabled={!isConfigured || isSaving}>
            {t("settings:generateVerificationCode")}
          </Button>
          <Button variant="secondary" onClick={handleClearCode} disabled={!localConfig.verificationCode || isSaving}>
            {t("settings:clearCode")}
          </Button>
          <Button variant="secondary" onClick={handleUnbind} disabled={!localConfig.boundUserId || isSaving}>
            {t("settings:unbindUser")}
          </Button>
        </div>
      </div>

      <div className="tw-space-y-2 tw-rounded-lg tw-border tw-p-4">
        <div className="tw-flex tw-items-center tw-gap-2 tw-font-medium">
          <MessageSquareMore className="tw-size-4" />
          {t("settings:imageAnalysis")}
        </div>
        <p className="tw-text-sm tw-text-gray-600">{t("settings:telegramImageAnalysisDescription", { name: localConfig.imageAnalysisSubagentName })}</p>
      </div>

      <div className="tw-flex tw-justify-end tw-pt-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? t("common:saving") : t("common:saveChanges")}
        </Button>
      </div>
    </div>
  );
};
