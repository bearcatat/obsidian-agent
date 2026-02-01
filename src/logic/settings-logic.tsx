import { ModelConfig, MCPServerConfig, SubAgentConfig } from "../types";
import { SettingsState } from "../state/settings-state-impl";
import { Plugin } from "obsidian";
import ToolManager from "../tools/ToolManager";
import MCPToolAdaptor from "../tools/MCP/MCPToolAdaptor";
import AIToolManager from "@/tool-ai/ToolManager";

export class SettingsLogic {
    private static instance: SettingsLogic;
    private state: SettingsState;
    private plugin?: Plugin;

    private constructor(state: SettingsState, plugin?: Plugin) {
        this.state = state;
        this.plugin = plugin;
    }

    static getInstance(state?: SettingsState, plugin?: Plugin): SettingsLogic {
        if (!SettingsLogic.instance) {
            const settingsState = state || SettingsState.getInstance();
            SettingsLogic.instance = new SettingsLogic(settingsState, plugin);
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
        if (originalId) {
            // 编辑操作：检查原模型是否存在
            const existingModel = this.state.models.find(m => m.id === originalId);
            if (!existingModel) {
                throw new Error(`Model with ID "${originalId}" not found`);
            }
        } else {
            // 添加操作：检查模型ID是否已存在
            const existingModel = this.state.models.find(m => m.id === model.id);
            if (existingModel) {
                throw new Error(`Model with ID "${model.id}" already exists`);
            }
        }
        
        this.state.addOrUpdateModel(model, originalId);
        await this.saveSettings();
    }

    async removeModel(modelId: string): Promise<void> {
        // 检查模型是否存在
        const existingModel = this.state.models.find(m => m.id === modelId);
        if (!existingModel) {
            throw new Error(`Model with ID "${modelId}" not found`);
        }

        this.state.removeModel(modelId);
        await this.saveSettings();
    }

    async reorderModels(newModels: ModelConfig[]): Promise<void> {
        // 验证新模型列表的完整性
        const currentModelIds = new Set(this.state.models.map(m => m.id));
        const newModelIds = new Set(newModels.map(m => m.id));
        
        if (currentModelIds.size !== newModelIds.size) {
            throw new Error("Model count mismatch during reordering");
        }
        
        for (const id of currentModelIds) {
            if (!newModelIds.has(id)) {
                throw new Error(`Model "${id}" missing during reordering`);
            }
        }

        this.state.reorderModels(newModels);
        await this.saveSettings();
    }

    async setDefaultAgentModel(model: ModelConfig | null): Promise<void> {
        // 如果设置了模型，验证模型是否存在
        if (model) {
            const existingModel = this.state.models.find(m => m.id === model.id);
            if (!existingModel) {
                throw new Error(`Model with ID "${model.id}" not found`);
            }
        }
        
        this.state.setDefaultAgentModel(model);
        await this.saveSettings();
    }

    async setTitleModel(model: ModelConfig | null): Promise<void> {
        // 如果设置了模型，验证模型是否存在
        if (model) {
            const existingModel = this.state.models.find(m => m.id === model.id);
            if (!existingModel) {
                throw new Error(`Model with ID "${model.id}" not found`);
            }
        }
        
        this.state.setTitleModel(model);
        await this.saveSettings();
    }

    // MCP服务器配置管理业务逻辑
    async addOrUpdateMCPServer(server: MCPServerConfig, originalName?: string): Promise<void> {
        if (originalName) {
            // 编辑操作：检查原服务器是否存在
            const existingServer = this.state.mcpServers.find(s => s.name === originalName);
            if (!existingServer) {
                throw new Error(`MCP Server with name "${originalName}" not found`);
            }
        } else {
            // 添加操作：检查服务器名称是否已存在
            const existingServer = this.state.mcpServers.find(s => s.name === server.name);
            if (existingServer) {
                throw new Error(`MCP Server with name "${server.name}" already exists`);
            }
        }
        
        this.state.addOrUpdateMCPServer(server, originalName);
        
        // 同步更新ToolManager
        await ToolManager.getInstance().updateMCPServers(this.state.mcpServers);
        await AIToolManager.getInstance().updateMCPServers(this.state.mcpServers);
        
        await this.saveSettings();
    }

    async removeMCPServer(serverName: string): Promise<void> {
        // 检查服务器是否存在
        const existingServer = this.state.mcpServers.find(s => s.name === serverName);
        if (!existingServer) {
            throw new Error(`MCP Server with name "${serverName}" not found`);
        }

        this.state.removeMCPServer(serverName);
        
        // 同步更新ToolManager
        await ToolManager.getInstance().updateMCPServers(this.state.mcpServers);
        await AIToolManager.getInstance().updateMCPServers(this.state.mcpServers);
        
        await this.saveSettings();
    }

    async reorderMCPServers(newServers: MCPServerConfig[]): Promise<void> {
        // 验证新服务器列表的完整性
        const currentServerNames = new Set(this.state.mcpServers.map(s => s.name));
        const newServerNames = new Set(newServers.map(s => s.name));
        
        if (currentServerNames.size !== newServerNames.size) {
            throw new Error("MCP Server count mismatch during reordering");
        }
        
        for (const name of currentServerNames) {
            if (!newServerNames.has(name)) {
                throw new Error(`MCP Server "${name}" missing during reordering`);
            }
        }

        this.state.reorderMCPServers(newServers);
        
        // 同步更新ToolManager
        await ToolManager.getInstance().updateMCPServers(this.state.mcpServers);
        await AIToolManager.getInstance().updateMCPServers(this.state.mcpServers);
        
        await this.saveSettings();
    }

    // 内置工具管理业务逻辑
    async updateBuiltinTool(toolName: string, enabled: boolean): Promise<void> {
        // 验证工具是否存在
        const existingTool = this.state.builtinTools.find(t => t.name === toolName);
        if (!existingTool) {
            throw new Error(`Builtin tool "${toolName}" not found`);
        }
        
        this.state.updateBuiltinTool(toolName, enabled);
        
        // 同步更新ToolManager
        await ToolManager.getInstance().updateBuiltinTools(this.state.builtinTools);
        await AIToolManager.getInstance().updateBuiltinTools(this.state.builtinTools);
        
        await this.saveSettings();
    }

    // SubAgent配置管理业务逻辑
    async addOrUpdateSubAgent(subAgent: SubAgentConfig, originalName?: string): Promise<void> {
        if (originalName) {
            // 编辑操作：检查原SubAgent是否存在
            const existingSubAgent = this.state.subAgents.find(s => s.name === originalName);
            if (!existingSubAgent) {
                throw new Error(`SubAgent with name "${originalName}" not found`);
            }
        } else {
            // 添加操作：检查SubAgent名称是否已存在
            const existingSubAgent = this.state.subAgents.find(s => s.name === subAgent.name);
            if (existingSubAgent) {
                throw new Error(`SubAgent with name "${subAgent.name}" already exists`);
            }
        }
        
        this.state.addOrUpdateSubAgent(subAgent, originalName);
        
        // 同步更新ToolManager
        await ToolManager.getInstance().updateSubAgents(this.state.subAgents);
        await AIToolManager.getInstance().updateSubAgents(this.state.subAgents);
        
        await this.saveSettings();
    }

    async removeSubAgent(subAgentName: string): Promise<void> {
        // 检查SubAgent是否存在
        const existingSubAgent = this.state.subAgents.find(s => s.name === subAgentName);
        if (!existingSubAgent) {
            throw new Error(`SubAgent with name "${subAgentName}" not found`);
        }
        
        this.state.removeSubAgent(subAgentName);
        
        // 同步更新ToolManager
        await ToolManager.getInstance().updateSubAgents(this.state.subAgents);
        await AIToolManager.getInstance().updateSubAgents(this.state.subAgents);
        
        await this.saveSettings();
    }

    async reorderSubAgents(newSubAgents: SubAgentConfig[]): Promise<void> {
        this.state.reorderSubAgents(newSubAgents);
        
        // 同步更新ToolManager
        await ToolManager.getInstance().updateSubAgents(this.state.subAgents);
        await AIToolManager.getInstance().updateSubAgents(this.state.subAgents);
        
        await this.saveSettings();
    }

    // 持久化方法
    async loadSettings(): Promise<void> {
        try {
            const savedData = await this.plugin?.loadData();
            if (savedData) {
                this.state.setAllData(savedData);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async saveSettings(): Promise<void> {
        try {
            const stateData = this.state.getAllData();
            await this.plugin?.saveData(stateData);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    async getMCPTools(server: MCPServerConfig): Promise<MCPToolAdaptor[]> {
        return ToolManager.getInstance().getMCPTools(server);
    }
}

export default SettingsLogic;
