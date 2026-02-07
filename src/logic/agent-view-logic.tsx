import { Context, MessageV2, ModelConfig } from "../types";
import { AgentState } from "../state/agent-state-impl";
import { App, TFile } from "obsidian";
import { UserMessage } from "@/messages/user-message";
import AIAgent from "@/llm-ai/Agent";
import AIModelManager from "@/llm-ai/ModelManager";


export class AgentViewLogic {
  private static instance: AgentViewLogic;
  private state: AgentState;

  private constructor(state: AgentState) {
    this.state = state;
  }

  static getInstance(state?: AgentState): AgentViewLogic {
    if (!AgentViewLogic.instance) {
      const agentState = state || AgentState.getInstance();
      AgentViewLogic.instance = new AgentViewLogic(agentState);
    }
    return AgentViewLogic.instance;
  }

  static resetInstance(): void {
    AgentViewLogic.instance = undefined as any;
  }

  // 业务逻辑方法
  async sendMessage(content: string, context: Context): Promise<void> {
    // 设置加载状态
    this.state.setLoading(true);
    const abortController = new AbortController()
    this.state.setAbortController(abortController);

    try {
      this.setTitleIfNewChat(content);
      // 添加用户消息
      const userMessage = new UserMessage(content, context);
      this.state.addMessage(userMessage);
      await AIAgent.getInstance().query(userMessage, abortController, (message: MessageV2) => this.state.addMessage(message))
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      this.state.setLoading(false);
    }
  }

  addMessage(message: MessageV2) {
    this.state.addMessage(message)
  }

  async setTitleIfNewChat(userMessage: string): Promise<void> {
    if (this.state.title === "New Chat") {
      // 使用 Agent 的 generateTitle 方法生成标题
      try {
        const title = await AIAgent.getInstance().generateTitle(userMessage);
        this.state.setTitle(title);
      } catch (error) {
        console.error('Failed to generate title:', error);
        // 如果标题生成失败，使用用户消息的前20个字符作为标题
        this.state.setTitle(userMessage.substring(0, 20) || "New Chat");
      }
    }
  }

  stopLoading(): void {
    if (this.state.abortController) {
      this.state.abortController.abort();
    }
    this.state.setLoading(false);
  }

  setTitle(title: string): void {
    this.state.setTitle(title);
  }

  resetForNewChat(app: App | undefined): void {
    this.stopLoading();
    const activeNote = app?.workspace.getActiveFile();
    this.state.resetForNewChat();
    AIAgent.getInstance().clearMemory();
  }

  setModel(model: ModelConfig): void {
    this.state.setModel(model);
    AIModelManager.getInstance().setAgent(model);
  }

  setTitleModel(model: ModelConfig): void {
    AIModelManager.getInstance().setTitle(model);
  }
}

export default AgentViewLogic;