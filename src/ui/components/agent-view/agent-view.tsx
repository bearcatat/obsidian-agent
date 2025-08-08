import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot } from 'react-dom/client';
import { Chat } from './chat';
import { AppContextProvider } from '../../../hooks/app-context';
import { IconManager } from '../../icons';
import { TooltipProvider } from '../../elements/tooltip';
import React from 'react';

export const AGENT_VIEW_TYPE = 'agent-view';

export class AgentView extends ItemView {
	private root: any = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return AGENT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Agent View';
	}

	getIcon(): string {
		return IconManager.getIconName();
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();

		// 创建React容器
		const reactContainer = container.createEl('div', { cls: 'tw-flex tw-size-full tw-flex-col tw-overflow-hidden' });

		// 创建React根节点
		this.root = createRoot(reactContainer);

		// 使用应用上下文包装组件
		this.root.render(
			<AppContextProvider app={this.app}>
				<TooltipProvider delayDuration={0}>
					<React.StrictMode>
						<Chat />
					</React.StrictMode>
				</TooltipProvider>
			</AppContextProvider>
		);
	}

	async onClose(): Promise<void> {
		// 清理React组件
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
	}
}
