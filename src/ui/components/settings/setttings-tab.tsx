import { App, PluginSettingTab } from "obsidian";
import { IObsidianAgentPlugin } from "../../../types";
import { createRoot } from "react-dom/client";
import { Settings } from "./settings";
import { ContainerContext } from "../../../hooks/container-context";
import { TabProvider } from "../../../hooks/TabContext";

export class ObsidianAgentSettingTab extends PluginSettingTab {
    plugin: IObsidianAgentPlugin;

    constructor(app: App, plugin: IObsidianAgentPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.style.userSelect = "text";
        const div = containerEl.createDiv("div");
        const sections = createRoot(div);

        sections.render(
            <ContainerContext.Provider value={containerEl}>
                <TabProvider>
                    <Settings />
                </TabProvider>
            </ContainerContext.Provider>
        );
    }
}