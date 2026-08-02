import { MessageV2, ModelConfig, ModelVariant, getDefaultVariant } from "../types";
import { agentStore } from "../state/agent-state-impl";
import { App, Notice } from "obsidian";
import { UserMessage } from "@/messages/user-message";
import AIAgent from "@/llm/Agent";
import AIModelManager from "@/llm/ModelManager";
import { CHAT_TITLE_MAX_LENGTH } from "@/llm/title-constants";
import { SessionLogic } from "./session-logic";
import { FileReviewLogic } from "./file-review-logic";
import SkillLogic from "./skill-logic";

export class AgentViewLogic {
  private static instance: AgentViewLogic;

  private constructor() {}

  static getInstance(): AgentViewLogic {
    if (!AgentViewLogic.instance) AgentViewLogic.instance = new AgentViewLogic();
    return AgentViewLogic.instance;
  }

  static resetInstance(): void {
    AgentViewLogic.instance = undefined as any;
  }

  async sendMessage(userMessage: UserMessage, requestedConversationId?: string): Promise<void> {
    let store = agentStore.getState();
    let conversationId = requestedConversationId ?? store.activeConversationId;
    if (!conversationId) {
      conversationId = await SessionLogic.getInstance().createSession();
      store.createConversation(conversationId);
      store = agentStore.getState();
    }
    if (requestedConversationId && !store.conversations[requestedConversationId]) return;
    const targetId = conversationId;

    const conversation = store.conversations[targetId];
    const model = store.model;
    const variant = store.variant;
    if (!conversation || conversation.isLoading || !model) return;

    store.setLoading(true, targetId);
    const abortController = new AbortController();
    store.setAbortController(abortController, targetId);
    let completedSuccessfully = false;

    try {
      const titlePromise = this.setTitleIfNewChat(userMessage.content, targetId);
      agentStore.getState().addMessage(userMessage, targetId);
      const current = agentStore.getState().conversations[targetId];
      const newModelMessages = await AIAgent.getInstance().query(
        userMessage,
        current.modelMessages,
        abortController,
        message => agentStore.getState().addMessage(message, targetId),
        {
          conversationId: targetId,
          model,
          variant,
          activeSkills: current.activeSkills,
          activateSkill: name => this.activateSkill(name, targetId),
        },
      );
      agentStore.getState().setModelMessages(newModelMessages, targetId);
      await titlePromise;
      completedSuccessfully = true;
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Failed to send message:', error);
        new Notice(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`, 3000);
      }
    } finally {
      const latest = agentStore.getState();
      latest.setLoading(false, targetId);
      latest.setAbortController(null, targetId);
      if (completedSuccessfully) {
        latest.setUnread(latest.activeConversationId !== targetId, targetId);
        latest.setUpdatedAt(Date.now(), targetId);
      }
      const completed = agentStore.getState().conversations[targetId];
      if (completedSuccessfully && completed) await SessionLogic.getInstance().saveSessionNow(completed);
    }
  }

  addMessage(message: MessageV2, conversationId?: string): void {
    agentStore.getState().addMessage(message, conversationId);
  }

  async setTitleIfNewChat(userMessage: string, conversationId?: string): Promise<void> {
    const store = agentStore.getState();
    const id = conversationId ?? store.activeConversationId;
    const conversation = id ? store.conversations[id] : null;
    if (!id || conversation?.title !== 'New Chat') return;

    const fallbackTitle = userMessage.substring(0, CHAT_TITLE_MAX_LENGTH).trim() || 'New Chat';
    try {
      const title = await AIAgent.getInstance().generateTitle(userMessage);
      agentStore.getState().setTitle(title.trim() || fallbackTitle, id);
    } catch (error) {
      console.error('Failed to generate title:', error);
      agentStore.getState().setTitle(fallbackTitle, id);
    }
  }

  stopLoading(): void {
    const id = agentStore.getState().activeConversationId;
    if (id) this.stopConversation(id);
  }

  stopConversation(conversationId: string): void {
    const store = agentStore.getState();
    store.conversations[conversationId]?.abortController?.abort();
    store.setLoading(false, conversationId);
  }

  setTitle(title: string): void {
    agentStore.getState().setTitle(title);
  }

  async finalizePendingReviews(): Promise<void> {
    const store = agentStore.getState();
    for (const conversation of Object.values(store.conversations)) {
      if (conversation.isLoading) continue;
      FileReviewLogic.getInstance().flushPendingAsApplied(conversation.sessionId);
      const latest = agentStore.getState().conversations[conversation.sessionId];
      if (latest) await SessionLogic.getInstance().saveSessionNow(latest);
    }
  }

  async resetForNewChat(_app: App | undefined): Promise<void> {
    const store = agentStore.getState();
    const active = store.activeConversationId ? store.conversations[store.activeConversationId] : null;
    if (active && active.messages.length === 0 && !active.isLoading) return;
    const id = await SessionLogic.getInstance().createSession();
    agentStore.getState().createConversation(id);
  }

  setModel(model: ModelConfig, variant?: ModelVariant | null): void {
    const nextVariant = variant === undefined ? getDefaultVariant(model) : variant;
    agentStore.getState().setModel(model);
    agentStore.getState().setVariant(nextVariant);
    AIModelManager.getInstance().setAgent(model, nextVariant);
  }

  setTitleModel(model: ModelConfig): void {
    AIModelManager.getInstance().setTitle(model);
  }

  activateSkill(name: string, conversationId?: string): boolean {
    if (!SkillLogic.getInstance().getSkillByName(name)) return false;
    const store = agentStore.getState();
    const id = conversationId ?? store.activeConversationId;
    const conversation = id ? store.conversations[id] : null;
    if (!id || !conversation) return false;
    store.setActiveSkills(Array.from(new Set([...conversation.activeSkills, name])), id);
    return true;
  }
}

export default AgentViewLogic;
