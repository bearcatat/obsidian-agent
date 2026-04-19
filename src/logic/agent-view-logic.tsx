import { Context, MessageV2, ModelConfig } from "../types";
import { agentStore } from "../state/agent-state-impl";
import { App, Notice, TFile } from "obsidian";
import { UserMessage } from "@/messages/user-message";
import AIAgent from "@/llm-ai/Agent";
import AIModelManager from "@/llm-ai/ModelManager";
import { CHAT_TITLE_MAX_LENGTH } from "@/llm-ai/title-constants";
import { SessionLogic } from "./session-logic";
import { FileReviewLogic } from "./file-review-logic";

export class AgentViewLogic {
  private static instance: AgentViewLogic;

  private constructor() {
    agentStore.subscribe((state, prevState) => {
      if (
        state.sessionId &&
        !state.isLoading &&
        (state.messages !== prevState.messages || state.fileReviews !== prevState.fileReviews)
      ) {
        SessionLogic.getInstance().saveSession(state);
      }
    });
  }

  static getInstance(): AgentViewLogic {
    if (!AgentViewLogic.instance) {
      AgentViewLogic.instance = new AgentViewLogic();
    }
    return AgentViewLogic.instance;
  }

  static resetInstance(): void {
    AgentViewLogic.instance = undefined as any;
  }

  // 业务逻辑方法
  async sendMessage(content: string, context: Context): Promise<void> {
    // 设置加载状态
    const store = agentStore.getState();
    if (!store.sessionId) {
      await SessionLogic.getInstance().createSession();
    }
    
    agentStore.getState().setLoading(true);
    const abortController = new AbortController()
    agentStore.getState().setAbortController(abortController);

    try {
      this.setTitleIfNewChat(content);
      // 添加用户消息
      const userMessage = new UserMessage(content, context);
      agentStore.getState().addMessage(userMessage);
      const currentStore = agentStore.getState();
      const newModelMessages = await AIAgent.getInstance().query(
        userMessage, 
        currentStore.modelMessages,
        abortController, 
        (message: MessageV2) => {
          agentStore.getState().addMessage(message);
        }
      );
      agentStore.getState().setModelMessages(newModelMessages);
    } catch (error) {
      console.error('Failed to send message:', error);
      new Notice(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`, 3000);
    } finally {
      agentStore.getState().setLoading(false);
      // Force a save after the turn completes
      SessionLogic.getInstance().saveSession(agentStore.getState());
    }
  }

  addMessage(message: MessageV2) {
    agentStore.getState().addMessage(message)
  }

  async setTitleIfNewChat(userMessage: string): Promise<void> {
    const store = agentStore.getState();
    if (store.title === "New Chat") {
      const fallbackTitle = userMessage.substring(0, CHAT_TITLE_MAX_LENGTH).trim() || "New Chat";
      // 使用 Agent 的 generateTitle 方法生成标题
      try {
        const title = await AIAgent.getInstance().generateTitle(userMessage);
        store.setTitle(title.trim() || fallbackTitle);
      } catch (error) {
        console.error('Failed to generate title:', error);
        // 如果标题生成失败，使用用户消息的前 CHAT_TITLE_MAX_LENGTH 个字符作为标题
        store.setTitle(fallbackTitle);
      }
    }
  }

  stopLoading(): void {
    const store = agentStore.getState();
    if (store.abortController) {
      store.abortController.abort();
    }
    store.setLoading(false);
  }

  setTitle(title: string): void {
    agentStore.getState().setTitle(title);
  }

  async finalizePendingReviews(): Promise<void> {
    const store = agentStore.getState();
    if (!store.sessionId) {
      return;
    }

    FileReviewLogic.getInstance().flushPendingAsApplied();
    await SessionLogic.getInstance().saveSessionNow(agentStore.getState());
  }

  async resetForNewChat(app: App | undefined): Promise<void> {
    this.stopLoading();
    await this.finalizePendingReviews();
    agentStore.getState().resetForNewChat();
    AIAgent.getInstance().clearMemory();
  }

  setModel(model: ModelConfig): void {
    agentStore.getState().setModel(model);
    AIModelManager.getInstance().setAgent(model);
  }

  setTitleModel(model: ModelConfig): void {
    AIModelManager.getInstance().setTitle(model);
  }
}

export default AgentViewLogic;