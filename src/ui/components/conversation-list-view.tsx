import React from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { ConversationSidebar } from './agent-view/conversation-sidebar';
import { AppContextProvider } from '@/hooks/app-context';
import { TooltipProvider } from '../elements/tooltip';
import { IconManager } from '../icons';
import { I18nextProvider, i18n } from '../../i18n/react';
import { t } from '../../i18n';

export const CONVERSATION_LIST_VIEW_TYPE = 'agent-conversation-list-view';

export class ConversationListView extends ItemView {
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return CONVERSATION_LIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('common:agentConversations');
  }

  getIcon(): string {
    return IconManager.getIconName();
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.style.margin = '0';
    container.style.padding = '0';
    const reactContainer = container.createEl('div', { cls: 'tw-flex tw-size-full tw-flex-col tw-overflow-hidden' });
    reactContainer.style.margin = '0';
    this.root = createRoot(reactContainer);
    this.root.render(
      <I18nextProvider i18n={i18n}>
        <AppContextProvider app={this.app}>
          <TooltipProvider delayDuration={0}>
            <React.StrictMode>
              <ConversationSidebar />
            </React.StrictMode>
          </TooltipProvider>
        </AppContextProvider>
      </I18nextProvider>,
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}
