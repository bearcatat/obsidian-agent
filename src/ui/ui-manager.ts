import { IconManager } from './icons';
import { ObsidianAgentSettingTab } from './components/settings/setttings-tab';
import { IObsidianAgentPlugin } from '../types';
import { AgentView, AGENT_VIEW_TYPE } from './components/agent-view/agent-view';

export class UIManager {
	private plugin: IObsidianAgentPlugin;
	private view: AgentView | null = null;

	constructor(plugin: IObsidianAgentPlugin) {
		this.plugin = plugin;
	}

	setupUI(): void {
		this.registerIcons();
		this.setupRibbonIcon();
		this.setupSettingTab();
		this.registerView();
	}

	private registerIcons(): void {
		IconManager.registerIcons();
	}

	private setupRibbonIcon(): void {
		const ribbonIconEl = this.plugin.addRibbonIcon(
			IconManager.getIconName(),
			'Obsidian Agent',
			this.handleRibbonClick
		);
		ribbonIconEl.addClass('obsidian-agent-ribbon-class');
	}

	private registerView(): void {
		this.plugin.registerView(
			AGENT_VIEW_TYPE,
			(leaf) => new AgentView(leaf)
		);
	}

	private handleRibbonClick = async (evt: MouseEvent): Promise<void> => {
		const { workspace } = this.plugin.app;
		
		// 检查视图是否已经存在
		const existingLeaf = workspace.getLeavesOfType(AGENT_VIEW_TYPE)[0];
		
		if (existingLeaf) {
			// 如果视图已存在，激活它
			workspace.revealLeaf(existingLeaf);
		} else {
			// 创建新的视图
			const leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: AGENT_VIEW_TYPE,
					active: true,
				});
				workspace.revealLeaf(leaf);
			}
		}
	}

	private setupSettingTab(): void {
		this.plugin.addSettingTab(new ObsidianAgentSettingTab(this.plugin.app, this.plugin));
	}

	cleanup(): void {
		// 清理UI资源
		// 注意：Obsidian会自动清理注册的视图和设置标签页
		// 这里主要清理自定义的资源
		console.log('UIManager cleanup completed');
	}
}
