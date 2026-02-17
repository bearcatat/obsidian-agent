import { Context, MessageV2, ModelConfig } from "../types";
import { useAgentStore, agentStore } from "../state/agent-state-impl";
import { App, TFile } from "obsidian";
import { UserMessage } from "@/messages/user-message";
import AIAgent from "@/llm-ai/Agent";
import AIModelManager from "@/llm-ai/ModelManager";


export class AgentViewLogic {
  private static instance: AgentViewLogic;

  private constructor() {}

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
    store.setLoading(true);
    const abortController = new AbortController()
    store.setAbortController(abortController);

    try {
      this.setTitleIfNewChat(content);
      // 添加用户消息
      const userMessage = new UserMessage(content, context);
      store.addMessage(userMessage);
      await AIAgent.getInstance().query(userMessage, abortController, (message: MessageV2) => {
        agentStore.getState().addMessage(message);
      })
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      agentStore.getState().setLoading(false);
    }
  }

  addMessage(message: MessageV2) {
    agentStore.getState().addMessage(message)
  }

  async setTitleIfNewChat(userMessage: string): Promise<void> {
    const store = agentStore.getState();
    if (store.title === "New Chat") {
      // 使用 Agent 的 generateTitle 方法生成标题
      try {
        const title = await AIAgent.getInstance().generateTitle(userMessage);
        store.setTitle(title);
      } catch (error) {
        console.error('Failed to generate title:', error);
        // 如果标题生成失败，使用用户消息的前20个字符作为标题
        store.setTitle(userMessage.substring(0, 20) || "New Chat");
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

  resetForNewChat(app: App | undefined): void {
    this.stopLoading();
    const activeNote = app?.workspace.getActiveFile();
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