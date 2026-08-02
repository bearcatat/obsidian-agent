import React, { useEffect, useMemo, useState } from "react";
import { LoaderCircle, MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "../../elements/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../elements/tooltip";
import { useAgentStore } from "@/state/agent-state-impl";
import { SessionLogic, SessionMetadata } from "@/logic/session-logic";
import { AgentViewLogic } from "@/logic/agent-view-logic";

export const ConversationSidebar: React.FC = () => {
  const [persisted, setPersisted] = useState<SessionMetadata[]>([]);
  const conversations = useAgentStore(state => state.conversations);
  const activeId = useAgentStore(state => state.activeConversationId);
  const selectConversation = useAgentStore(state => state.selectConversation);
  const upsertConversation = useAgentStore(state => state.upsertConversation);
  const removeConversation = useAgentStore(state => state.removeConversation);

  useEffect(() => {
    void SessionLogic.getInstance().listSessions().then(setPersisted);
  }, []);

  const items = useMemo(() => {
    const metadata = new Map(persisted.map(item => [item.id, item]));
    for (const conversation of Object.values(conversations)) {
      if (conversation.messages.length === 0) continue;
      metadata.set(conversation.sessionId, {
        id: conversation.sessionId,
        title: conversation.title,
        updatedAt: conversation.updatedAt,
        hasUnread: conversation.hasUnread,
      });
    }
    return Array.from(metadata.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [conversations, persisted]);

  const discardEmptyDraft = () => {
    const store = useAgentStore.getState();
    const id = store.activeConversationId;
    const active = id ? store.conversations[id] : null;
    if (id && active && active.messages.length === 0 && !active.isLoading) {
      store.removeConversation(id);
    }
  };

  const createConversation = async () => {
    await AgentViewLogic.getInstance().resetForNewChat(undefined);
  };

  const openConversation = async (id: string) => {
    discardEmptyDraft();
    const store = useAgentStore.getState();
    if (store.conversations[id]) {
      const wasUnread = store.conversations[id].hasUnread;
      store.selectConversation(id);
      if (wasUnread) {
        const readConversation = useAgentStore.getState().conversations[id];
        if (readConversation) SessionLogic.getInstance().saveSession(readConversation);
      }
      return;
    }

    const loaded = await SessionLogic.getInstance().loadSession(id);
    if (loaded) {
      const latestStore = useAgentStore.getState();
      loaded.model = latestStore.model;
      loaded.variant = latestStore.variant;
      upsertConversation(loaded);
      selectConversation(id);
      if (loaded.hasUnread) {
        const readConversation = useAgentStore.getState().conversations[id];
        if (readConversation) SessionLogic.getInstance().saveSession(readConversation);
      }
    }
  };

  const deleteConversation = async (id: string) => {
    AgentViewLogic.getInstance().stopConversation(id);
    const conversation = useAgentStore.getState().conversations[id];
    if (conversation) await SessionLogic.getInstance().saveSessionNow(conversation);
    await SessionLogic.getInstance().deleteSession(id);
    removeConversation(id);
    setPersisted(current => current.filter(item => item.id !== id));
  };

  return (
    <aside className="tw-m-0 tw-flex tw-h-full tw-w-full tw-min-w-0 tw-flex-col">
      <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-1">
        <span className="tw-text-base tw-font-normal">CHATS</span>
        <Button variant="ghost2" size="fit" className="tw-text-base tw-font-normal" onClick={() => void createConversation()}>
          <MessageSquarePlus className="tw-mr-1 tw-size-4" />New Chat
        </Button>
      </div>
      <div className="nav-files-container tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-2 tw-py-1">
        {items.map(item => {
          const live = conversations[item.id];
          const isActive = activeId === item.id;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? 'page' : undefined}
                  className={`nav-file-title tw-group tw-m-0 tw-flex tw-items-center tw-gap-2 tw-rounded-md tw-px-2 tw-py-1 tw-text-base tw-font-normal hover:tw-bg-[var(--nav-item-background-hover)] hover:tw-text-[var(--nav-item-color-hover)] ${isActive ? 'is-active' : ''}`}
                  style={isActive ? {
                    backgroundColor: 'var(--nav-item-background-active)',
                    color: 'var(--nav-item-color-active)',
                  } : undefined}
                  onClick={() => void openConversation(item.id)}
                >
                  <div className="nav-file-title-content tw-min-w-0 tw-flex-1 tw-truncate">{item.title}</div>
                  <span className="tw-flex tw-size-3.5 tw-shrink-0 tw-items-center tw-justify-center group-hover:tw-hidden">
                    {live?.isLoading ? (
                      <LoaderCircle className="tw-size-3.5 tw-animate-spin tw-text-accent" />
                    ) : (live?.hasUnread ?? item.hasUnread) ? (
                      <span className="tw-size-2 tw-rounded-full" style={{ backgroundColor: 'var(--interactive-accent)' }} />
                    ) : null}
                  </span>
                  <Button
                    variant="ghost2"
                    size="icon"
                    className="tw-hidden !tw-size-3.5 !tw-min-h-0 !tw-min-w-0 tw-shrink-0 tw-p-0 group-hover:tw-flex"
                    aria-label={`Delete ${item.title}`}
                    onClick={event => {
                      event.stopPropagation();
                      void deleteConversation(item.id);
                    }}
                  >
                    <Trash2 className="tw-size-3" />
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Updated {new Date(item.updatedAt).toLocaleString()}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </aside>
  );
};
