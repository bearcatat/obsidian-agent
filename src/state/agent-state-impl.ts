import { IAgentState, AgentStateData } from './agent-state';
import { ModelConfig } from '../types';
import { MessageV2 } from '@/types';


export class AgentState implements IAgentState {
  private static instance: AgentState;
  private _data: AgentStateData;
  private listeners: Set<(state: AgentStateData) => void> = new Set();

  private constructor(initialData?: Partial<AgentStateData>) {
    this._data = {
      messages: [],
      isLoading: false,
      title: 'New Chat',
      model: null,
      abortController: null,
      ...initialData,
    };
  }

  static getInstance(initialData?: Partial<AgentStateData>): AgentState {
    if (!AgentState.instance) {
      AgentState.instance = new AgentState(initialData);
    }
    return AgentState.instance;
  }

  static resetInstance(): void {
    AgentState.instance = undefined as any;
  }

  // 只读属性访问器
  get messages(): (MessageV2)[] {
    return this._data.messages ? [...this._data.messages] : [];
  }

  get isLoading(): boolean {
    return this._data.isLoading;
  }

  get title(): string {
    return this._data.title;
  }

  get model(): ModelConfig | null {
    return this._data.model;
  }

  get abortController(): AbortController | null {
    return this._data.abortController;
  }

  // 订阅状态变化
  subscribe(listener: (state: AgentStateData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // 通知所有监听器
  private notify(): void {
    this.listeners.forEach(listener => listener({ ...this._data }));
  }

  // 纯状态操作方法（不包含业务逻辑）
  setLoading(isLoading: boolean): void {
    this._data.isLoading = isLoading;
    this.notify();
  }

  addMessage(message: MessageV2) {
    const lastMessage = this._data.messages[this._data.messages.length - 1];

    // 优化流式消息处理：移除之前的流式消息，如果消息id相同
    if (lastMessage && lastMessage.id === message.id) {
      this._data.messages.pop();
    }

    // 限制消息数量，防止内存无限增长
    const MAX_MESSAGES = 100;
    if (this._data.messages.length >= MAX_MESSAGES) {
      // 保留最新的消息，移除最旧的消息
      this._data.messages = this._data.messages.slice(-MAX_MESSAGES + 1);
    }

    this._data.messages.push(message);
    this.notify();
  }

  setTitle(title: string): void {
    this._data.title = title;
    this.notify();
  }

  setModel(model: ModelConfig): void {
    this._data.model = model;
    this.notify();
  }

  setAbortController(abortController: AbortController): void {
    this._data.abortController = abortController;
    this.notify();
  }

  resetForNewChat(): void {
    this._data.messages = [];
    this._data.isLoading = false;
    this._data.title = 'New Chat';
    this._data.abortController = null;
    this.notify();
  }

  // 清理所有监听器
  clearListeners(): void {
    this.listeners.clear();
  }

  // 清理旧消息，释放内存
  cleanupOldMessages(keepCount: number = 50): void {
    if (this._data.messages.length > keepCount) {
      this._data.messages = this._data.messages.slice(-keepCount);
      this.notify();
    }
  }

  // 清理流式消息
  cleanupStreamingMessages(): void {
    this._data.messages = this._data.messages.filter(message => !message.isStreaming);
    this.notify();
  }
}
