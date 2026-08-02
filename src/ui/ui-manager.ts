import { IconManager } from './icons';
import { ObsidianAgentSettingTab } from './components/settings/setttings-tab';
import { IObsidianAgentPlugin } from '../types';
import { AgentView, AGENT_VIEW_TYPE } from './components/agent-view/agent-view';
import { ConversationListView, CONVERSATION_LIST_VIEW_TYPE } from './components/conversation-list-view';
import { WorkspaceLeaf } from 'obsidian';

export class UIManager {
	private plugin: IObsidianAgentPlugin;

	constructor(plugin: IObsidianAgentPlugin) {
		this.plugin = plugin;
	}

	setupUI(): void {
		this.registerIcons();
		this.setupRibbonIcon();
		this.setupSettingTab();
		this.registerViews();
	}

	private registerIcons(): void {
		IconManager.registerIcons();
	}

	private setupRibbonIcon(): void {
		const ribbonIconEl = this.plugin.addRibbonIcon(
			IconManager.getIconName(),
			'Obsidian Agent',
			this.handleRibbonClick,
		);
		ribbonIconEl.addClass('obsidian-agent-ribbon-class');
	}

	private registerViews(): void {
		this.plugin.registerView(AGENT_VIEW_TYPE, leaf => new AgentView(leaf));
		this.plugin.registerView(CONVERSATION_LIST_VIEW_TYPE, leaf => new ConversationListView(leaf));
	}

	private handleRibbonClick = async (_evt: MouseEvent): Promise<void> => {
		const { workspace } = this.plugin.app;

		let conversationLeaf: WorkspaceLeaf | null = workspace.getLeavesOfType(CONVERSATION_LIST_VIEW_TYPE)[0] ?? null;
		if (!conversationLeaf) {
			conversationLeaf = workspace.getLeftLeaf(false);
			if (conversationLeaf) {
				await conversationLeaf.setViewState({ type: CONVERSATION_LIST_VIEW_TYPE, active: true });
			}
		}
		if (conversationLeaf) await workspace.revealLeaf(conversationLeaf);

		let agentLeaf: WorkspaceLeaf | null = workspace.getLeavesOfType(AGENT_VIEW_TYPE)[0] ?? null;
		if (!agentLeaf) {
			agentLeaf = workspace.getRightLeaf(false);
			if (agentLeaf) {
				await agentLeaf.setViewState({ type: AGENT_VIEW_TYPE, active: true });
			}
		}
		if (agentLeaf) await workspace.revealLeaf(agentLeaf);
	}

	private setupSettingTab(): void {
		this.plugin.addSettingTab(new ObsidianAgentSettingTab(this.plugin.app, this.plugin));
	}

	cleanup(): void {
	}
}
