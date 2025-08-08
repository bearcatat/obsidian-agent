import { ModelConfig } from "../types";
import { SettingsState } from "../state/settings-state-impl";
import { Plugin } from "obsidian";

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

    async setBochaaiApiKey(bochaaiApiKey: string): Promise<void> {
        this.state.setBochaaiApiKey(bochaaiApiKey);
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
}

export default SettingsLogic;
