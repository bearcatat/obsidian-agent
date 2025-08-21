import { ISettingsState, SettingsStateData } from './settings-state';
import { ModelConfig, MCPServerConfig, BuiltinToolConfig } from '../types';

export class SettingsState implements ISettingsState {
  private static instance: SettingsState;
  private _data: SettingsStateData;
  private listeners: Set<(state: SettingsStateData) => void> = new Set();

  private constructor(initialData?: Partial<SettingsStateData>) {
    this._data = {
      models: [],
      defaultAgentModel: null,
      titleModel: null,
      mcpServers: [],
      builtinTools: [
        {
          name: "getCurrentTime",
          description: "获取当前时间信息",
          enabled: true,
          category: "Time"
        },
        {
          name: "readNoteByPath", 
          description: "根据文件路径读取笔记内容",
          enabled: true,
          category: "Note"
        },
        {
          name: "readNoteByLink",
          description: "根据链接读取笔记内容", 
          enabled: true,
          category: "Note"
        }
      ],
      ...initialData,
    };
  }

  static getInstance(initialData?: Partial<SettingsStateData>): SettingsState {
    if (!SettingsState.instance) {
      SettingsState.instance = new SettingsState(initialData);
    }
    return SettingsState.instance;
  }

  static resetInstance(): void {
    SettingsState.instance = undefined as any;
  }

  // 只读属性访问器
  get models(): ModelConfig[] {
    return [...this._data.models];
  }

  get defaultAgentModel(): ModelConfig | null {
    return this._data.defaultAgentModel;
  }

  get titleModel(): ModelConfig | null {
    return this._data.titleModel;
  }

  get mcpServers(): MCPServerConfig[] {
    return [...this._data.mcpServers];
  }

  get builtinTools(): BuiltinToolConfig[] {
    return [...this._data.builtinTools];
  }

  // 订阅状态变化
  subscribe(listener: (state: SettingsStateData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // 通知所有监听器
  private notify(): void {
    this.listeners.forEach(listener => listener({ ...this._data }));
  }

  addOrUpdateModel(model: ModelConfig, originalId?: string): void {
    const existingIndex = this._data.models.findIndex(m => m.id === (originalId || model.id));
    
    if (existingIndex >= 0) {
      // 更新现有模型
      this._data.models = this._data.models.map((model, index) => 
        index === existingIndex ? model : model
      );
      this._data.models[existingIndex] = model;
    } else {
      // 添加新模型
      this._data.models = [...this._data.models, model];
    }
    
    this.notify();
  }

  removeModel(modelId: string): void {
    this._data.models = this._data.models.filter(model => model.id !== modelId);
    
    // 如果删除的模型是默认模型或标题模型，则清空对应设置
    if (this._data.defaultAgentModel?.id === modelId) {
      this._data.defaultAgentModel = null;
    }
    if (this._data.titleModel?.id === modelId) {
      this._data.titleModel = null;
    }
    
    this.notify();
  }

  reorderModels(newModels: ModelConfig[]): void {
    this._data.models = newModels;
    this.notify();
  }

  setDefaultAgentModel(model: ModelConfig | null): void {
    this._data.defaultAgentModel = model;
    this.notify();
  }

  setTitleModel(model: ModelConfig | null): void {
    this._data.titleModel = model;
    this.notify();
  }

  // MCP服务器配置管理
  addOrUpdateMCPServer(server: MCPServerConfig, originalName?: string): void {
    const existingIndex = this._data.mcpServers.findIndex(s => s.name === (originalName || server.name));
    
    if (existingIndex >= 0) {
      // 更新现有服务器
      this._data.mcpServers = this._data.mcpServers.map((s, index) => 
        index === existingIndex ? server : s
      );
    } else {
      // 添加新服务器
      this._data.mcpServers = [...this._data.mcpServers, server];
    }
    
    this.notify();
  }

  removeMCPServer(serverName: string): void {
    this._data.mcpServers = this._data.mcpServers.filter(server => server.name !== serverName);
    this.notify();
  }

  reorderMCPServers(newServers: MCPServerConfig[]): void {
    this._data.mcpServers = newServers;
    this.notify();
  }

  // 内置工具管理
  updateBuiltinTool(toolName: string, enabled: boolean): void {
    this._data.builtinTools = this._data.builtinTools.map(tool =>
      tool.name === toolName ? { ...tool, enabled } : tool
    );
    this.notify();
  }

  // 获取所有数据用于持久化
  getAllData(): SettingsStateData {
    return { ...this._data };
  }

  // 设置所有数据（用于加载）
  setAllData(data: SettingsStateData): void {
    this._data = { 
      // 确保所有字段都有默认值，兼容旧数据
      models: data.models || [],
      defaultAgentModel: data.defaultAgentModel || null,
      titleModel: data.titleModel || null,
      mcpServers: data.mcpServers || [],
      builtinTools: data.builtinTools || [
        {
          name: "getCurrentTime",
          description: "获取当前时间信息",
          enabled: true,
          category: "Time"
        },
        {
          name: "readNoteByPath", 
          description: "根据文件路径读取笔记内容",
          enabled: true,
          category: "Note"
        },
        {
          name: "readNoteByLink",
          description: "根据链接读取笔记内容", 
          enabled: true,
          category: "Note"
        }
      ]
    };
    this.notify();
  }

  // 清理所有监听器
  clearListeners(): void {
    this.listeners.clear();
  }
}
