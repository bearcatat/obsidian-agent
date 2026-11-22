import { assertValidModelIdentity, ModelConfig, ModelVariant, MCPServerConfig, ExaSearchConfig, BochaSearchConfig, TelegramFeedbackConfig, MemorySettings, normalizeMemoryIdleHours, resolveModelVariant } from "../types";
import { settingsStore } from "../state/settings-state-impl";
import { Plugin } from "obsidian";
import AIToolManager from "@/tool/ToolManager";
import { normalizeBuiltinTools } from "@/tool/BuiltinTools";
import { ToolSet } from "ai";
import { setSettingsPlugin } from "./settings-persistence";
import TelegramFeedbackRuntime from "@/tool/TelegramFeedback/TelegramFeedbackRuntime";
import MemoryJobQueue from "@/logic/memory-job-queue";
import { AgentViewLogic } from "@/logic/agent-view-logic";
import { agentStore } from "@/state/agent-state-impl";
import { OfficialModelCatalog, DEEPSEEK_SECRET_ID } from '@/llm/OfficialModelCatalog';
import { clearOfficialDeepSeekSelections, isOfficialDeepSeek } from '@/llm/official-model-selection';
import { writeSecretAndConfirm } from '@/llm/credentials';
import { persistModelTransaction } from './model-persistence-transaction';
import { selectableModels } from '@/llm/selectable-model-utils';
import { t } from '@/i18n';

export class SettingsLogic {
    private static instance: SettingsLogic;
    private plugin?: Plugin;
    private saveQueue: Promise<void> = Promise.resolve();
    private catalog?: OfficialModelCatalog;

    private constructor(plugin?: Plugin) {
        this.plugin = plugin;
        if (plugin) {
            setSettingsPlugin(plugin);
        }
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
        setSettingsPlugin(plugin);
    }

    // 模型管理业务逻辑
    async addOrUpdateModel(model: ModelConfig, originalId?: string): Promise<void> {
        if (model.source === 'official') throw new Error(t('settings:officialModelsReadOnly'));
        assertValidModelIdentity(model);
        if (model.contextWindow !== undefined
            && (!Number.isFinite(model.contextWindow) || model.contextWindow <= 0)) {
            throw new Error('Context window must be a positive number');
        }
        if (model.contextWindow !== undefined
            && model.maxTokens !== undefined
            && model.contextWindow <= model.maxTokens) {
            throw new Error('Context window must be larger than Max Output Tokens');
        }
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

        if (model.connectionMode === 'official' && model.provider === 'deepseek') {
            if (!this.plugin?.app.secretStorage.getSecret(DEEPSEEK_SECRET_ID)) throw new Error(t('settings:officialDeepSeekKeyRequired'));
            model = { ...model, baseUrl: undefined, credentialRef: DEEPSEEK_SECRET_ID };
        }
        if (model.connectionMode === 'custom' && model.credentialRef && !this.plugin?.app.secretStorage.getSecret(model.credentialRef)) {
            throw new Error(t('settings:secretNotFound', { id: model.credentialRef }));
        }
        const candidate: ModelConfig = { ...model, source: 'user', apiKey: model.credentialRef ? undefined : model.apiKey };
        const previousModels = state.models.map((item) => ({ ...item }));
        const previousDefault = state.defaultAgentModel;
        const previousTitle = state.titleModel;
        const previousImage = state.imageModel;
        await persistModelTransaction(
          () => state.addOrUpdateModel(candidate, originalId),
          () => {
            settingsStore.setState({ models: previousModels, defaultAgentModel: previousDefault, titleModel: previousTitle, imageModel: previousImage });
          },
          () => this.saveSettings(),
        );
        const selectedAgentModel = agentStore.getState().model;
        if (selectedAgentModel && (selectedAgentModel.id === (originalId ?? candidate.id))) {
            AgentViewLogic.getInstance().setModel(
                candidate,
                resolveModelVariant(candidate, agentStore.getState().variant),
            );
        }
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

    createCustomSecret(secretId: string, value: string): void {
        if (!this.plugin) throw new Error(t('settings:settingsPluginUnavailable'));
        if (!/^[a-z0-9-]+$/.test(secretId)) throw new Error(t('settings:customSecretIdFormat'));
        writeSecretAndConfirm(this.plugin.app.secretStorage, secretId, value);
    }

    listSecretIds(): string[] {
        if (!this.plugin) return [];
        return this.plugin.app.secretStorage.listSecrets().sort();
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

    async setDefaultAgentModel(model: ModelConfig | null, variant: ModelVariant | null = null): Promise<void> {
        const state = settingsStore.getState();
        const availableModels = selectableModels(this.getOfficialModels(), state.models);
        // 如果设置了模型，验证模型是否存在
        if (model) {
            const existingModel = availableModels.find((m: ModelConfig) => m.id === model.id);
            if (!existingModel) {
                throw new Error(`Model with ID "${model.id}" not found`);
            }
        }

        const effectiveModel = model ?? availableModels[0] ?? null;
        const nextVariant = effectiveModel ? resolveModelVariant(effectiveModel, variant) : null;
        state.setDefaultAgentModel(model, nextVariant);
        if (!state.titleModel && effectiveModel) {
            AgentViewLogic.getInstance().setTitleModel(
                effectiveModel,
                null,
            );
        }
        await this.saveSettings();
    }

    async setTitleModel(model: ModelConfig | null, variant: ModelVariant | null = null): Promise<void> {
        const state = settingsStore.getState();
        const availableModels = selectableModels(this.getOfficialModels(), state.models);
        // 如果设置了模型，验证模型是否存在
        if (model) {
            const existingModel = availableModels.find((m: ModelConfig) => m.id === model.id);
            if (!existingModel) {
                throw new Error(`Model with ID "${model.id}" not found`);
            }
        }

        const effectiveModel = model ?? state.defaultAgentModel ?? availableModels[0] ?? null;
        state.setTitleModel(model, null);
        if (effectiveModel) {
            AgentViewLogic.getInstance().setTitleModel(effectiveModel, null);
        }
        await this.saveSettings();
    }

    async setImageModel(model: ModelConfig | null, variant: ModelVariant | null = null): Promise<void> {
        const state = settingsStore.getState();
        const availableModels = selectableModels(this.getOfficialModels(), state.models);
        if (model) {
            const existingModel = availableModels.find((m: ModelConfig) => m.id === model.id);
            if (!existingModel) {
                throw new Error(`Model with ID "${model.id}" not found`);
            }
        }

        state.setImageModel(model, null);
        await this.saveSettings();
    }

    async setAutoContextCompaction(enabled: boolean): Promise<void> {
        settingsStore.getState().setAutoContextCompaction(enabled);
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
        await AIToolManager.getInstance().updateMCPServers(settingsStore.getState().mcpServers);

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
        await AIToolManager.getInstance().updateMCPServers(settingsStore.getState().mcpServers);

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
        await AIToolManager.getInstance().updateMCPServers(settingsStore.getState().mcpServers);

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
        await AIToolManager.getInstance().updateBuiltinTools(settingsStore.getState().builtinTools);

        await this.saveSettings();
    }

    // 持久化方法
    async loadSettings(): Promise<void> {
        try {
            const savedData = await this.plugin?.loadData();
            if (savedData) {
                settingsStore.getState().setAllData(savedData);
                const normalizedBuiltinTools = normalizeBuiltinTools(savedData.builtinTools);
                if (JSON.stringify(savedData.builtinTools || []) !== JSON.stringify(normalizedBuiltinTools)
                    || Object.prototype.hasOwnProperty.call(savedData, 'bashPermissions')
                    || Object.prototype.hasOwnProperty.call(savedData, 'bashSandbox')) {
                    await this.saveSettings();
                }
            }
            this.catalog = new OfficialModelCatalog(this.plugin!.app, settingsStore.getState().officialModelCatalog);
            this.catalog.subscribe(() => {
                settingsStore.getState().setOfficialModelCatalog(this.catalog!.getCache());
                void this.saveSettings().catch((error) => console.error('Failed to persist official model catalog:', error));
            });
            await this.catalog.refresh();
            // 异步初始化，不阻塞插件加载
            TelegramFeedbackRuntime.getInstance().configure(settingsStore.getState().telegramFeedbackConfig).catch((error: unknown) => {
                console.error('[TelegramFeedbackRuntime] Background configure failed:', error);
            });
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async saveSettings(): Promise<void> {
        const state = settingsStore.getState();
        const stateData = JSON.parse(JSON.stringify({
                models: state.models,
                officialModelCatalog: state.officialModelCatalog,
                defaultAgentModel: state.defaultAgentModel,
                defaultAgentModelVariant: state.defaultAgentModelVariant,
                titleModel: state.titleModel,
                titleModelVariant: state.titleModelVariant,
                imageModel: state.imageModel,
                imageModelVariant: state.imageModelVariant,
                autoContextCompaction: state.autoContextCompaction,
                mcpServers: state.mcpServers,
                builtinTools: normalizeBuiltinTools(state.builtinTools),
                exaSearchConfig: state.exaSearchConfig,
                bochaSearchConfig: state.bochaSearchConfig,
                telegramFeedbackConfig: state.telegramFeedbackConfig,
                bashExecution: state.bashExecution,
                memorySettings: state.memorySettings,
            }));
        const pending = this.saveQueue.then(async () => {
            if (!this.plugin) throw new Error('Settings plugin is unavailable');
            await this.plugin.saveData(stateData);
        });
        this.saveQueue = pending.catch(() => undefined);
        await pending;
    }

    async getMCPTools(server: MCPServerConfig): Promise<ToolSet> {
        return AIToolManager.getInstance().getMCPTools(server);
    }

    async getAIMCPTools(config: MCPServerConfig): Promise<ToolSet> {
        return AIToolManager.getInstance().getMCPTools(config);
    }

    // Exa搜索配置管理业务逻辑
    async updateExaSearchConfig(config: ExaSearchConfig): Promise<void> {
        const state = settingsStore.getState();
        state.setExaSearchConfig(config);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateExaSearchConfig(config);

        await this.saveSettings();
    }

    async setExaSearchEnabled(enabled: boolean): Promise<void> {
        const state = settingsStore.getState();
        state.updateExaSearchEnabled(enabled);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateExaSearchConfig(settingsStore.getState().exaSearchConfig);

        await this.saveSettings();
    }

    // Bocha搜索配置管理业务逻辑
    async updateBochaSearchConfig(config: BochaSearchConfig): Promise<void> {
        const state = settingsStore.getState();
        state.setBochaSearchConfig(config);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateBochaSearchConfig(config);

        await this.saveSettings();
    }

    async setBochaSearchEnabled(enabled: boolean): Promise<void> {
        const state = settingsStore.getState();
        state.updateBochaSearchEnabled(enabled);

        // 同步更新ToolManager
        await AIToolManager.getInstance().updateBochaSearchConfig(settingsStore.getState().bochaSearchConfig);

        await this.saveSettings();
    }

    async updateTelegramFeedbackConfig(config: TelegramFeedbackConfig): Promise<void> {
        const state = settingsStore.getState();
        state.setTelegramFeedbackConfig(config);
        await TelegramFeedbackRuntime.getInstance().configure(config);
        await AIToolManager.getInstance().updateTelegramFeedbackConfig(config);
        await this.saveSettings();
    }

    async generateTelegramVerificationCode(config?: TelegramFeedbackConfig): Promise<TelegramFeedbackConfig> {
        const state = settingsStore.getState();
        const baseConfig = config ?? state.telegramFeedbackConfig;
        const generatedAt = Date.now();
        const nextConfig: TelegramFeedbackConfig = {
            ...baseConfig,
            verificationCode: `${Math.floor(100000 + Math.random() * 900000)}`,
            verificationGeneratedAt: generatedAt,
            verificationExpiresAt: generatedAt + 10 * 60 * 1000,
        };

        state.setTelegramFeedbackConfig(nextConfig);
        await TelegramFeedbackRuntime.getInstance().configure(nextConfig);
        await AIToolManager.getInstance().updateTelegramFeedbackConfig(nextConfig);
        await this.saveSettings();
        return nextConfig;
    }

    async clearTelegramVerificationCode(config?: TelegramFeedbackConfig): Promise<TelegramFeedbackConfig> {
        const state = settingsStore.getState();
        const baseConfig = config ?? state.telegramFeedbackConfig;
        const nextConfig: TelegramFeedbackConfig = {
            ...baseConfig,
            verificationCode: "",
            verificationGeneratedAt: null,
            verificationExpiresAt: null,
        };

        state.setTelegramFeedbackConfig(nextConfig);
        await TelegramFeedbackRuntime.getInstance().configure(nextConfig);
        await AIToolManager.getInstance().updateTelegramFeedbackConfig(nextConfig);
        await this.saveSettings();
        return nextConfig;
    }

    async clearTelegramBinding(config?: TelegramFeedbackConfig): Promise<TelegramFeedbackConfig> {
        const state = settingsStore.getState();
        const baseConfig = config ?? state.telegramFeedbackConfig;
        const nextConfig: TelegramFeedbackConfig = {
            ...baseConfig,
            boundUserId: null,
            boundChatId: null,
            boundUsername: "",
            boundFirstName: "",
            boundAt: null,
        };

        state.setTelegramFeedbackConfig(nextConfig);
        await TelegramFeedbackRuntime.getInstance().configure(nextConfig);
        await AIToolManager.getInstance().updateTelegramFeedbackConfig(nextConfig);
        await this.saveSettings();
        return nextConfig;
    }

    async updateMemorySettings(config: MemorySettings): Promise<void> {
        const normalized: MemorySettings = {
            ...config,
            idleHours: normalizeMemoryIdleHours(config.idleHours),
            indexMaxLines: Math.min(200, Math.max(20, config.indexMaxLines)),
            indexMaxBytes: Math.min(25 * 1024, Math.max(1024, config.indexMaxBytes)),
            dailyCallLimit: Number.isFinite(config.dailyCallLimit) ? Math.max(0, Math.floor(config.dailyCallLimit)) : 0,
            maxRetries: Math.min(5, Math.max(0, config.maxRetries)),
            minMessages: Math.max(2, config.minMessages),
            minTextChars: Math.max(100, config.minTextChars),
        };
        settingsStore.getState().setMemorySettings(normalized);
        await AIToolManager.getInstance().refreshMemoryTools();
        await MemoryJobQueue.getInstance().configure();
        await this.saveSettings();
    }

    getOfficialModels(): ModelConfig[] { return this.catalog?.getModels() ?? []; }

    async refreshOfficialModelCatalog(): Promise<void> {
        if (this.catalog) await this.catalog.refresh();
    }

    async setDeepSeekOfficialSecret(value: string): Promise<void> {
        if (!this.plugin) throw new Error(t('settings:settingsPluginUnavailable'));
        writeSecretAndConfirm(this.plugin.app.secretStorage, DEEPSEEK_SECRET_ID, value, true);
        if (!this.catalog) this.catalog = new OfficialModelCatalog(this.plugin.app, settingsStore.getState().officialModelCatalog);
        await this.catalog.refresh();
        if (!value) {
            const state = settingsStore.getState();
            const cleared = clearOfficialDeepSeekSelections({ current: agentStore.getState().model, defaultModel: state.defaultAgentModel, title: state.titleModel, image: state.imageModel });
            if (cleared.current === null && isOfficialDeepSeek(agentStore.getState().model)) {
                agentStore.setState({ model: null, variant: null });
            }
            state.setDefaultAgentModel(cleared.defaultModel, cleared.defaultModel ? state.defaultAgentModelVariant : null);
            state.setTitleModel(cleared.title, null);
            state.setImageModel(cleared.image, null);
        }
        await this.saveSettings();
    }

}

export default SettingsLogic;
