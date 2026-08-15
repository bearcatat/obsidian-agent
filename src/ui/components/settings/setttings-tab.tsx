import { App, PluginSettingTab } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { IObsidianAgentPlugin } from "../../../types";
import { Settings } from "./settings";
import { TabProvider } from "../../../hooks/TabContext";
import { PortalContainerProvider } from "../../../hooks/PortalContainerContext";
import { I18nextProvider, i18n } from "../../../i18n/react";
import { resources } from "../../../i18n";

const SETTINGS_HOST_CLASS = "obsidian-agent-settings-host";
const SETTINGS_ROOT_CLASS = "obsidian-agent-settings-react-root";

const SETTING_SEARCH_ALIAS_KEYS = [
  "models",
  "chatModels",
  "modelSettings",
  "defaultAgentModel",
  "titleGenerationModel",
  "imageAnalysisModel",
  "tool",
  "provider",
  "displayName",
  "modelName",
  "baseUrl",
  "apiKey",
  "contextWindow",
  "automaticallyCompactContext",
  "temperature",
  "maxOutputTokens",
  "topP",
  "frequencyPenalty",
  "presencePenalty",
  "useCorsProxy",
  "builtinTools",
  "bashExecutionPolicy",
  "directExecution",
  "rulesApproval",
  "aiApproval",
  "commandPattern",
  "externalTools",
  "exaWebSearch",
  "bochaWebSearch",
  "telegramFeedback",
  "mcpServers",
  "serverName",
  "transportType",
  "environmentVariables",
  "serverUrl",
  "headers",
  "command",
  "commands",
  "builtInCommands",
  "customCommands",
  "skills",
  "subagents",
  "rules",
  "memory",
  "idleThreshold",
  "maxBackgroundCalls",
  "clearAllMemory",
] as const;

const getSettingSearchAliases = (): string[] => Array.from(new Set(
  SETTING_SEARCH_ALIAS_KEYS.flatMap(key => [
    resources["zh-CN"].settings[key],
    resources["en-US"].settings[key],
  ]),
));

const getActiveSettingsResource = () => (
  i18n.language === "zh-CN" ? resources["zh-CN"].settings : resources["en-US"].settings
);

export class ObsidianAgentSettingTab extends PluginSettingTab {
  plugin: IObsidianAgentPlugin;
  private reactRoot: Root | null = null;

  constructor(app: App, plugin: IObsidianAgentPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: getActiveSettingsResource().agentSettings,
        desc: getActiveSettingsResource().settingsDescription,
        aliases: getSettingSearchAliases(),
        render: (setting) => this.mountSettings(setting.settingEl),
      },
    ];
  }

  display(): void {
    this.mountSettings(this.containerEl);
  }

  hide(): void {
    this.unmountSettings();
    super.hide();
  }

  private mountSettings(containerEl: HTMLElement): () => void {
    this.unmountSettings();
    containerEl.empty();
    containerEl.addClass(SETTINGS_HOST_CLASS);

    const reactContainer = containerEl.createDiv({ cls: SETTINGS_ROOT_CLASS });
    const root = createRoot(reactContainer);
    this.reactRoot = root;
    const portalContainer = containerEl.ownerDocument.body;

    root.render(
      <I18nextProvider i18n={i18n}>
        <PortalContainerProvider container={portalContainer}>
          <TabProvider modalContainer={portalContainer}>
            <Settings />
          </TabProvider>
        </PortalContainerProvider>
      </I18nextProvider>,
    );

    return () => this.unmountSettings(root);
  }

  private unmountSettings(root: Root | null = this.reactRoot): void {
    if (!root || this.reactRoot !== root) {
      return;
    }

    root.unmount();
    this.reactRoot = null;
  }
}
