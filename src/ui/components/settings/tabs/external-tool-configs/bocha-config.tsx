import { useState, useCallback } from "react";
import { Button } from "@/ui/elements/button";
import { Input } from "@/ui/elements/input";
import { Label } from "@/ui/elements/label";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { useSettingsStore } from "@/hooks/use-settings";
import { useShallow } from "zustand/react/shallow";
import { BochaSearchConfig } from "@/types";
import SettingsLogic from "@/logic/settings-logic";
import { ExternalLink, Key, Settings2 } from "lucide-react";

interface BochaConfigProps {
  onSave?: () => void;
}

export const BochaConfig: React.FC<BochaConfigProps> = ({ onSave }) => {
  const { bochaSearchConfig } = useSettingsStore(
    useShallow((state) => ({
      bochaSearchConfig: state.bochaSearchConfig,
    }))
  );

  const [localConfig, setLocalConfig] = useState<BochaSearchConfig>(bochaSearchConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const settingsLogic = SettingsLogic.getInstance();

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await settingsLogic.updateBochaSearchConfig(localConfig);
      onSave?.();
    } catch (error) {
      console.error("Failed to save Bocha search config:", error);
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
            API Key
          </Label>
          <a
            href="https://open.bochaai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-blue-500 hover:tw-text-blue-600 tw-transition-colors"
          >
            Get API Key
            <ExternalLink className="tw-size-3" />
          </a>
        </div>
        <div className="tw-flex tw-gap-2">
          <Input
            id="bocha-api-key"
            type={showApiKey ? "text" : "password"}
            placeholder="Enter your Bocha API key"
            value={localConfig.apiKey}
            onChange={(e) => setLocalConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
            className="tw-flex-1"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            {showApiKey ? "Hide" : "Show"}
          </Button>
        </div>
      </div>

      {/* Enable/Disable Switch */}
      <div className="tw-flex tw-items-center tw-justify-between tw-p-4 tw-bg-secondary/50 tw-rounded-lg">
        <div className="tw-space-y-1">
          <Label className="tw-text-base tw-font-medium">Enable Bocha Web Search</Label>
          <p className="tw-text-sm tw-text-gray-500">
            Allow the AI agent to search the web using Bocha API
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
          Default Parameters
        </Label>

        <div className="tw-grid tw-grid-cols-2 tw-gap-4">
          <div className="tw-space-y-2">
            <Label htmlFor="bocha-count" className="tw-text-sm">
              Number of Results
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
            <p className="tw-text-xs tw-text-gray-500">Range: 1-50</p>
          </div>

          <div className="tw-space-y-2">
            <Label htmlFor="bocha-freshness" className="tw-text-sm">
              Time Range
            </Label>
            <select
              id="bocha-freshness"
              value={localConfig.freshness || "noLimit"}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  freshness: e.target.value as BochaSearchConfig["freshness"],
                }))
              }
              className="tw-w-full tw-px-3 tw-py-2 tw-border tw-border-gray-300 tw-rounded-md tw-bg-white tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-accent"
            >
              <option value="noLimit">No limit</option>
              <option value="oneYear">Past year</option>
              <option value="oneMonth">Past month</option>
              <option value="oneWeek">Past week</option>
              <option value="oneDay">Past day</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="tw-flex tw-justify-end tw-pt-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
