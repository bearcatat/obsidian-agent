import { useSettingsLogic, useSettingsState } from "@/hooks/use-settings";
import { SettingItem } from "@/ui/elements/setting-item";

export const ToolSetting: React.FC = () => {
  const { bochaaiApiKey } = useSettingsState();
  const { setBochaaiApiKey } = useSettingsLogic();

  return (
    <div className="tw-space-y-4">
      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">Tools</div>
        <SettingItem
            type="text"
            title="Bochaai API Key"
            description="The API key for Bochaai"
            value={bochaaiApiKey}
            onChange={(value) => setBochaaiApiKey(value)}
          />
      </section>
    </div>
  );
};