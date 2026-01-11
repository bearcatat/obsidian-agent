import { Message, ModelConfig } from "../types";
import { AgentState } from "../state/agent-state-impl";
import { App, TFile } from "obsidian";
import ModelManager from "../llm/ModelManager";
import Agent from "../llm/Agent";
import { v4 as uuidv4 } from "uuid";
import { UserMessage } from "@/messages/user-message";


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
  async sendMessage(content: string): Promise<void> {
    // 设置加载状态
    this.state.setLoading(true);
    this.state.setAbortController(new AbortController());

    try {
      this.setTitleIfNewChat(content);
      // 添加用户消息
      // const userMessage: Message = {
      //   id: uuidv4(),
      //   content,
      //   role: 'user',
      //   isStreaming: false,
      // };
      const userMessage = new UserMessage(content);
      this.state.addMessage(userMessage);
      const agent = Agent.getInstance();
      for await (const message of agent.query(userMessage, this.state.activeNote, this.state.contextNotes)) {
        if (message.id == "") {
          continue;
        }
        this.state.addMessage(message);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      this.state.setLoading(false);
    }
  }

  async setTitleIfNewChat(userMessage: string): Promise<void> {
    if (this.state.title === "New Chat") {
      // 使用 Agent 的 generateTitle 方法生成标题
      try {
        const agent = Agent.getInstance();
        const title = await agent.generateTitle(userMessage);
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

  // 活动笔记相关业务逻辑
  setActiveNote(activeNote: TFile | null): void {
    this.state.setActiveNote(activeNote);
  }

  addContextNote(note: TFile, isActive: boolean): void {
    this.state.addContextNote(note, isActive);
  }

  removeContextNote(path: string): void {
    this.state.removeContextNote(path);
  }

  setTitle(title: string): void {
    this.state.setTitle(title);
  }

  resetForNewChat(app: App | undefined): void {
    this.stopLoading();
    const activeNote = app?.workspace.getActiveFile();
    this.state.resetForNewChat();
    if (activeNote) {
      this.state.setActiveNote(activeNote);
    }
    Agent.getInstance().clearMemory();
  }

  setModel(model: ModelConfig): void {
    this.state.setModel(model);
    ModelManager.getInstance().setAgentModel(model);
  }

  setTitleModel(model: ModelConfig): void {
    ModelManager.getInstance().setTitleModel(model);
  }
}

export default AgentViewLogic;