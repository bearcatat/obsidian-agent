import { SubAgentConfig } from "../../types";
import SubAgent from "../../llm/SubAgent";
import SubAgentToolAdaptor from "./SubAgentToolAdaptor";
import ModelManager from "../../llm/ModelManager";
import { StructuredToolInterface } from "@langchain/core/tools";
import { SettingsState } from "../../state/settings-state-impl";
import { ModelConfig } from "../../types";

export default class SubAgentManager {
  private subAgentConfigs: SubAgentConfig[] = [];
  private subAgentInstanceMap: Map<string, SubAgentToolAdaptor> = new Map();

  // 更新SubAgent配置
  async updateSubAgents(subAgents: SubAgentConfig[]): Promise<void> {
    this.subAgentConfigs = subAgents;
    await this.initializeSubAgents();
  }

  // 初始化SubAgent实例
  private async initializeSubAgents(): Promise<void> {
    // 清理现有实例
    this.subAgentInstanceMap.clear();

    // 只为启用的SubAgent创建实例
    for (const config of this.subAgentConfigs) {
      if (config.enabled) {
        try {
          await this.createSubAgentInstance(config);
        } catch (error) {
          console.error(`Failed to create SubAgent instance for ${config.name}:`, error);
        }
      }
    }
  }

  // 创建SubAgent实例
  private async createSubAgentInstance(config: SubAgentConfig): Promise<void> {
    // 获取模型
    const modelConfig = await this.getModelConfig(config.modelId);
    if (!modelConfig) {
      throw new Error(`Model with ID "${config.modelId}" not found`);
    }

    const model = await ModelManager.getInstance().createStreamer(modelConfig);    
    // 创建SubAgent实例
    const subAgent = new SubAgent(config.name, config.systemPrompt, model);
    
    // 创建工具适配器
    const toolAdaptor = new SubAgentToolAdaptor(subAgent);
    this.subAgentInstanceMap.set(config.name, toolAdaptor);
  }

  // 获取模型配置
  private async getModelConfig(modelId: string): Promise<ModelConfig | null> {
    const settingsState = SettingsState.getInstance();
    const models = settingsState.models;
    return models.find(model => model.id === modelId) || null;
  }

  async setAllSubAgentTools(allTools: StructuredToolInterface[]): Promise<void> {
    this.subAgentConfigs.forEach(async config => {
      const subAgentInstance = this.subAgentInstanceMap.get(config.name);
      if (subAgentInstance) {
        const tools = await this.getToolsForSubAgent(config, allTools);
        subAgentInstance.setSubAgentTools(tools);
      }
    });
  }

  // 获取SubAgent的工具
  private async getToolsForSubAgent(config: SubAgentConfig, allTools: StructuredToolInterface[]): Promise<StructuredToolInterface[]> {
    // 根据配置过滤工具
    const enabledToolNames = config.tools
      .filter(tool => tool.enabled)
      .map(tool => tool.name);
    return allTools.filter(tool => enabledToolNames.includes(tool.name));
  }

  // 获取启用的工具
  getEnabledTools(): SubAgentToolAdaptor[] {
    const enableSubAgents =this.subAgentConfigs.filter(subAgent => subAgent.enabled)
    if (enableSubAgents.length === 0) {
      return [];
    }
    const adpators: SubAgentToolAdaptor[] = [];
    for (const subAgentConfig of enableSubAgents) {
      const subAgentInstance = this.subAgentInstanceMap.get(subAgentConfig.name);
      if (subAgentInstance) {
        adpators.push(subAgentInstance);
      }
    }
    return adpators;
  }

  getAllSubAgents(): SubAgentToolAdaptor[] {
    return Array.from(this.subAgentInstanceMap.values());
  }

  // 清理资源
  close(): void {
    this.subAgentInstanceMap.clear();
  }
}
