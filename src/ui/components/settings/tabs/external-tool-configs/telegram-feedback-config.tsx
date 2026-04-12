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
      return `Bound to @${localConfig.boundUsername || "unknown"} (${localConfig.boundFirstName || "Telegram user"})`;
    }

    if (localConfig.verificationCode && localConfig.verificationExpiresAt) {
      return `Pending verification code: ${localConfig.verificationCode} (expires ${new Date(localConfig.verificationExpiresAt).toLocaleString()})`;
    }

    return "Not bound";
  }, [localConfig]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await settingsLogic.updateTelegramFeedbackConfig(localConfig);
      new Notice("Telegram feedback config saved.", 3000);
      onSave?.();
    } catch (error) {
      console.error("Failed to save Telegram feedback config:", error);
      new Notice(`Failed to save Telegram feedback config: ${error instanceof Error ? error.message : "Unknown error"}`, 5000);
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
      new Notice(`Failed to generate Telegram verification code: ${error instanceof Error ? error.message : "Unknown error"}`, 5000);
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
      new Notice(`Failed to clear Telegram verification code: ${error instanceof Error ? error.message : "Unknown error"}`, 5000);
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
      new Notice(`Failed to clear Telegram binding: ${error instanceof Error ? error.message : "Unknown error"}`, 5000);
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
            Bot Token
          </Label>
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="tw-text-sm tw-text-blue-500 hover:tw-text-blue-600 tw-transition-colors"
          >
            Get Token
          </a>
        </div>
        <div className="tw-flex tw-gap-2">
          <Input
            id="telegram-bot-token"
            type={showToken ? "text" : "password"}
            placeholder="Enter your Telegram bot token"
            value={localConfig.botToken}
            onChange={(event) => setLocalConfig((prev) => ({ ...prev, botToken: event.target.value }))}
            className="tw-flex-1"
          />
          <Button variant="secondary" size="sm" onClick={() => setShowToken((prev) => !prev)}>
            {showToken ? "Hide" : "Show"}
          </Button>
        </div>
      </div>

      <div className="tw-space-y-2">
        <Label htmlFor="telegram-proxy-url" className="tw-flex tw-items-center tw-gap-2">
          <Link2 className="tw-size-4" />
          Proxy URL
        </Label>
        <Input
          id="telegram-proxy-url"
          placeholder="http://127.0.0.1:7890 or socks5://127.0.0.1:1080"
          value={localConfig.proxyUrl}
          onChange={(event) => setLocalConfig((prev) => ({ ...prev, proxyUrl: event.target.value }))}
        />
        <p className="tw-text-xs tw-text-gray-500">Supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxy URLs.</p>
      </div>

      <div className="tw-flex tw-items-center tw-justify-between tw-p-4 tw-bg-secondary/50 tw-rounded-lg">
        <div className="tw-space-y-1">
          <Label className="tw-text-base tw-font-medium">Enable Telegram Runtime</Label>
          <p className="tw-text-sm tw-text-gray-500">Start Telegram long polling inside the plugin and allow the agent to send feedback requests.</p>
        </div>
        <SettingSwitch
          checked={localConfig.enabled}
          onCheckedChange={(checked) => setLocalConfig((prev) => ({ ...prev, enabled: checked }))}
          disabled={!isConfigured}
        />
      </div>

      <div className="tw-grid tw-grid-cols-2 tw-gap-4">
        <div className="tw-space-y-2">
          <Label htmlFor="telegram-polling-timeout">Polling Timeout (seconds)</Label>
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

        <div className="tw-space-y-2">
          <Label htmlFor="telegram-feedback-timeout">Feedback Timeout (ms)</Label>
          <Input
            id="telegram-feedback-timeout"
            type="number"
            min={10000}
            max={3600000}
            step={1000}
            value={localConfig.feedbackTimeoutMs}
            onChange={(event) =>
              setLocalConfig((prev) => ({
                ...prev,
                feedbackTimeoutMs: Math.min(3600000, Math.max(10000, parseInt(event.target.value, 10) || 300000)),
              }))
            }
          />
        </div>
      </div>

      <div className="tw-space-y-3 tw-rounded-lg tw-border tw-p-4">
        <div className="tw-flex tw-items-center tw-gap-2 tw-font-medium">
          <ShieldCheck className="tw-size-4" />
          User Binding
        </div>
        <p className="tw-text-sm tw-text-gray-600">{bindingStatus}</p>
        <div className="tw-flex tw-flex-wrap tw-gap-2">
          <Button variant="secondary" onClick={handleGenerateCode} disabled={!isConfigured || isSaving}>
            Generate Verification Code
          </Button>
          <Button variant="secondary" onClick={handleClearCode} disabled={!localConfig.verificationCode || isSaving}>
            Clear Code
          </Button>
          <Button variant="secondary" onClick={handleUnbind} disabled={!localConfig.boundUserId || isSaving}>
            Unbind User
          </Button>
        </div>
      </div>

      <div className="tw-space-y-2 tw-rounded-lg tw-border tw-p-4">
        <div className="tw-flex tw-items-center tw-gap-2 tw-font-medium">
          <MessageSquareMore className="tw-size-4" />
          Image Analysis
        </div>
        <p className="tw-text-sm tw-text-gray-600">A fixed built-in subagent named <span className="tw-font-mono">{localConfig.imageAnalysisSubagentName}</span> will analyze image replies before the result is returned to the main agent.</p>
      </div>

      <div className="tw-flex tw-justify-end tw-pt-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};