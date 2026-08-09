import { App, PluginSettingTab } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { IObsidianAgentPlugin } from "../../../types";
import { Settings } from "./settings";
import { TabProvider } from "../../../hooks/TabContext";
import { PortalContainerProvider } from "../../../hooks/PortalContainerContext";

const SETTINGS_HOST_CLASS = "obsidian-agent-settings-host";
const SETTINGS_ROOT_CLASS = "obsidian-agent-settings-react-root";

const SETTING_SEARCH_ALIASES = [
  "Models",
  "Chat models",
  "Model settings",
  "Default agent model",
  "Title generation model",
  "Image analysis model",
  "Provider",
  "Display name",
  "Model name",
  "Base URL",
  "API key",
  "Temperature",
  "Max output tokens",
  "Top P",
  "Frequency penalty",
  "Presence penalty",
  "CORS proxy",
  "Tools",
  "Builtin tools",
  "Bash permissions",
  "默认策略",
  "命令模式",
  "External tools",
  "Exa web search",
  "Bocha web search",
  "Telegram feedback",
  "MCP servers",
  "Server name",
  "Transport type",
  "Environment variables",
  "Server URL",
  "Headers",
  "Commands",
  "Built-in commands",
  "Custom commands",
  "Skills",
  "SubAgents",
  "Rules",
  "Memory",
  "Idle threshold",
  "Extraction model",
  "Consolidation model",
  "Max background model calls per day",
  "Clear all memory",
];

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
        name: "Agent settings",
        desc: "Configure models, tools, extensions, permissions, and memory.",
        aliases: SETTING_SEARCH_ALIASES,
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
      <PortalContainerProvider container={portalContainer}>
        <TabProvider modalContainer={portalContainer}>
          <Settings />
        </TabProvider>
      </PortalContainerProvider>,
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
