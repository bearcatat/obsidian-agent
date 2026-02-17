import { ModelConfig, MCPServerConfig, SubAgentConfig } from "../types";
import { settingsStore } from "../state/settings-state-impl";
import { Plugin } from "obsidian";
import AIToolManager from "@/tool-ai/ToolManager";
import { ToolSet } from "ai";

export class SettingsLogic {
    private static instance: SettingsLogic;
    private plugin?: Plugin;

    private constructor(plugin?: Plugin) {
        this.plugin = plugin;
    }

    static getInstance(plugin?: Plugin): SettingsLogic {
        if (!SettingsLogic.instance) {
            SettingsLogic.instance = new SettingsLogic(plugin);
        }
        return SettingsLogic.instance;
    }

    static resetInstance(): void {
        SettingsLogic.instance = undefined as any;
    }

    // 设置Plugin实例（用于持久化）
    setPlugin(plugin: Plugin): void {
        this.plugin = plugin;
    }

    // 模型管理业务逻辑
    async addOrUpdateModel(model: ModelConfig, originalId?: string): Promise<void> {
        const state = settingsStore.getState();
        if (originalId) {
            // 编辑操作：检查原模型是否存在
            const existingModel = state.models.find((m: ModelConfig) => m.id === originalId);
            if (!existingModel) {
                throw new Error(`Model with ID "${originalId}" not found`);
            }
        } else {
            // 添加操作：检查模型ID是否已存在
            const existingModel = state.models.find((m: ModelConfig) => m.id === model.id);
            if (existingModel) {
                throw new Error(`Model with ID "${model.id}" already exists`);
            }
        }
        
        state.addOrUpdateModel(model, originalId);
        await this.saveSettings();
    }

    async removeModel(modelId: string): Promise<void> {
        const state = settingsStore.getState();
        // 检查模型是否存在
        const existingModel = state.models.find((m: ModelConfig) => m.id === modelId);
        if (!existingModel) {
            throw new Error(`Model with ID "${modelId}" not found`);
        }

        state.removeModel(modelId);
        await this.saveSettings();
    }

    async reorderModels(newModels: ModelConfig[]): Promise<void> {
        const state = settingsStore.getState();
        // 验证新模型列表的完整性
        const currentModelIds = new Set(state.models.map((m: ModelConfig) => m.id));
        const newModelIds = new Set(newModels.map((m: ModelConfig) => m.id));
        
        if (currentModelIds.size !== newModelIds.size) {
            throw new Error("Model count mismatch during reordering");
        }
        
        for (const id of currentModelIds) {
            if (!newModelIds.has(id)) {
                throw new Error(`Model "${id}" missing during reordering`);
            }
        }

        state.reorderModels(newModels);
        await this.saveSettings();
    }

    async setDefaultAgentModel(model: ModelConfig | null): Promise<void> {
        const state = settingsStore.getState();
        // 如果设置了模型，验证模型是否存在
        if (model) {
            const existingModel = state.models.find((m: ModelConfig) => m.id === model.id);
            if (!existingModel) {
                throw new Error(`Model with ID "${model.id}" not found`);
            }
        }
        
        state.setDefaultAgentModel(model);
        await this.saveSettings();
    }

    async setTitleModel(model: ModelConfig | null): Promise<void> {
        const state = settingsStore.getState();
        // 如果设置了模型，验证模型是否存在
        if (model) {
            const existingModel = state.models.find((m: ModelConfig) => m.id === model.id);
            if (!existingModel) {
                throw new Error(`Model with ID "${model.id}" not found`);
            }
        }
        
        state.setTitleModel(model);
        await this.saveSettings();
    }

    // MCP服务器配置管理业务逻辑
    async addOrUpdateMCPServer(server: MCPServerConfig, originalName?: string): Promise<void> {
        const state = settingsStore.getState();
        if (originalName) {
            // 编辑操作：检查原服务器是否存在
            const existingServer = state.mcpServers.find((s: MCPServerConfig) => s.name === originalName);
            if (!existingServer) {
                throw new Error(`MCP Server with name "${originalName}" not found`);
            }
        } else {
            // 添加操作：检查服务器名称是否已存在
            const existingServer = state.mcpServers.find((s: MCPServerConfig) => s.name === server.name);
            if (existingServer) {
                throw new Error(`MCP Server with name "${server.name}" already exists`);
            }
        }
        
        state.addOrUpdateMCPServer(server, originalName);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateMCPServers(state.mcpServers);

        await this.saveSettings();
    }

    async removeMCPServer(serverName: string): Promise<void> {
        const state = settingsStore.getState();
        // 检查服务器是否存在
        const existingServer = state.mcpServers.find((s: MCPServerConfig) => s.name === serverName);
        if (!existingServer) {
            throw new Error(`MCP Server with name "${serverName}" not found`);
        }

        state.removeMCPServer(serverName);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateMCPServers(state.mcpServers);

        await this.saveSettings();
    }

    async reorderMCPServers(newServers: MCPServerConfig[]): Promise<void> {
        const state = settingsStore.getState();
        // 验证新服务器列表的完整性
        const currentServerNames = new Set(state.mcpServers.map((s: MCPServerConfig) => s.name));
        const newServerNames = new Set(newServers.map((s: MCPServerConfig) => s.name));

        if (currentServerNames.size !== newServerNames.size) {
            throw new Error("MCP Server count mismatch during reordering");
        }

        for (const name of currentServerNames) {
            if (!newServerNames.has(name)) {
                throw new Error(`MCP Server "${name}" missing during reordering`);
            }
        }

        state.reorderMCPServers(newServers);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateMCPServers(state.mcpServers);

        await this.saveSettings();
    }

    // 内置工具管理业务逻辑
    async updateBuiltinTool(toolName: string, enabled: boolean): Promise<void> {
        const state = settingsStore.getState();
        // 验证工具是否存在
        const existingTool = state.builtinTools.find((t: { name: string }) => t.name === toolName);
        if (!existingTool) {
            throw new Error(`Builtin tool "${toolName}" not found`);
        }
        
        state.updateBuiltinTool(toolName, enabled);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateBuiltinTools(state.builtinTools);

        await this.saveSettings();
    }

    // SubAgent配置管理业务逻辑
    async addOrUpdateSubAgent(subAgent: SubAgentConfig, originalName?: string): Promise<void> {
        const state = settingsStore.getState();
        if (originalName) {
            // 编辑操作：检查原SubAgent是否存在
            const existingSubAgent = state.subAgents.find((s: SubAgentConfig) => s.name === originalName);
            if (!existingSubAgent) {
                throw new Error(`SubAgent with name "${originalName}" not found`);
            }
        } else {
            // 添加操作：检查SubAgent名称是否已存在
            const existingSubAgent = state.subAgents.find((s: SubAgentConfig) => s.name === subAgent.name);
            if (existingSubAgent) {
                throw new Error(`SubAgent with name "${subAgent.name}" already exists`);
            }
        }

        state.addOrUpdateSubAgent(subAgent, originalName);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateSubAgents(state.subAgents);

        await this.saveSettings();
    }

    async removeSubAgent(subAgentName: string): Promise<void> {
        const state = settingsStore.getState();
        // 检查SubAgent是否存在
        const existingSubAgent = state.subAgents.find((s: SubAgentConfig) => s.name === subAgentName);
        if (!existingSubAgent) {
            throw new Error(`SubAgent with name "${subAgentName}" not found`);
        }

        state.removeSubAgent(subAgentName);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateSubAgents(state.subAgents);

        await this.saveSettings();
    }

    async reorderSubAgents(newSubAgents: SubAgentConfig[]): Promise<void> {
        const state = settingsStore.getState();
        state.reorderSubAgents(newSubAgents);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateSubAgents(state.subAgents);

        await this.saveSettings();
    }

    // 持久化方法
    async loadSettings(): Promise<void> {
        try {
            const savedData = await this.plugin?.loadData();
            if (savedData) {
                settingsStore.getState().setAllData(savedData);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async saveSettings(): Promise<void> {
        try {
            const state = settingsStore.getState();
            const stateData = {
                models: state.models,
                defaultAgentModel: state.defaultAgentModel,
                titleModel: state.titleModel,
                mcpServers: state.mcpServers,
                builtinTools: state.builtinTools,
                subAgents: state.subAgents,
            };
            await this.plugin?.saveData(stateData);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    async getMCPTools(server: MCPServerConfig): Promise<ToolSet> {
        return AIToolManager.getInstance().getMCPTools(server);
    }

    async getAIMCPTools(config: MCPServerConfig): Promise<ToolSet>{
        return AIToolManager.getInstance().getMCPTools(config);
    }
}

export default SettingsLogic;
