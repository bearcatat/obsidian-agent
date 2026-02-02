import { Plugin } from 'obsidian';
import { IObsidianAgentPlugin } from './types';
import { UIManager } from './ui/ui-manager';
import { SettingsState } from './state/settings-state-impl';
import { SettingsLogic } from './logic/settings-logic';
import { AgentViewLogic } from './logic/agent-view-logic';
import { setGlobalApp, clearGlobalApp } from './utils';
import { AgentState } from './state/agent-state-impl';
import AgentMemoryManager from './llm/AgentMemoryManager';
import ModelManager from './llm/ModelManager';
import ToolManager from './tools/ToolManager';
import Agent from './llm/Agent';
import AIToolManager from './tool-ai/ToolManager';

export default class ObsidianAgentPlugin extends Plugin implements IObsidianAgentPlugin {
	private uiManager: UIManager;

	async onload() {
		// 设置全局App访问器
		setGlobalApp(this.app);

		try {
			// 优先初始化设置，确保模型配置可用
			await this.initializeSettings();

			// 初始化UI，让用户看到界面
			this.initializeUI();

			// 异步初始化Agent工具（非阻塞）
			this.initializeAgent().catch(error => {
				console.error('Agent initialization failed:', error);
			});
		} catch (error) {
			console.error('Failed to initialize plugin:', error);
		}
	}

	async onunload() {
		console.log('Starting plugin cleanup...');

		try {
			// 1. 中断正在进行的请求
			const agentState = AgentState.getInstance();
			if (agentState.abortController) {
				console.log('Aborting ongoing requests...');
				agentState.abortController.abort();
			}

			// 2. 清理 UI 管理器
			if (this.uiManager) {
				console.log('Cleaning up UI manager...');
				this.uiManager.cleanup();
			}

			// 3. 清理内存管理器（在重置之前）
			console.log('Clearing agent memory...');
			// 注意：AgentMemoryManager没有静态方法，需要创建实例
			const memoryManager = new AgentMemoryManager();
			memoryManager.clearMessages();

			// 4. 重置单例实例
			console.log('Resetting singleton instances...');
			AgentViewLogic.resetInstance();
			SettingsLogic.resetInstance();
			ModelManager.resetInstance();
			ToolManager.resetInstance();
			await AIToolManager.resetInstance();
			Agent.resetInstance();
			// AgentMemoryManager没有静态方法，不需要重置

			// 5. 清理全局引用
			console.log('Clearing global references...');
			clearGlobalApp();

			// 6. 清理状态监听器
			console.log('Clearing state listeners...');
			agentState.clearListeners();
			SettingsState.getInstance().clearListeners();

			// 7. 重置状态实例（可选，因为单例会在下次使用时重新创建）
			console.log('Resetting state instances...');
			AgentState.resetInstance();
			SettingsState.resetInstance();

			console.log('Plugin cleanup completed successfully');
		} catch (error) {
			console.error('Error during plugin cleanup:', error);
		}
	}

	async loadSettings() {
		// 这个方法现在由SettingsLogic处理
	}

	async saveSettings() {
		// 这个方法现在由SettingsLogic处理
	}

	private async initializeSettings(): Promise<void> {
		try {
			// 1. 初始化State和Logic
			const settingsState = SettingsState.getInstance();
			const settingsLogic = SettingsLogic.getInstance(settingsState, this);

			// 2. 加载持久化数据
			await settingsLogic.loadSettings();
			console.log('Settings initialized successfully');
		} catch (error) {
			console.error('Failed to initialize settings:', error);
		}
	}

	private initializeUI(): void {
		this.uiManager = new UIManager(this);
		this.uiManager.setupUI();
	}

	private async initializeAgent(): Promise<void> {
		const settingsState = SettingsState.getInstance();
		const modelConfigs = settingsState.models;

		if (modelConfigs.length > 0) {
			// 优先使用设置的默认模型，如果没有设置则使用第一个模型
			const defaultModel = settingsState.defaultAgentModel || modelConfigs[0];
			AgentViewLogic.getInstance().setModel(defaultModel);

			// 设置标题模型（如果有设置的话）
			if (settingsState.titleModel) {
				AgentViewLogic.getInstance().setTitleModel(settingsState.titleModel);
			} else {
				AgentViewLogic.getInstance().setTitleModel(defaultModel);
			}
		}

		// 初始化工具管理器
		try {
			const toolManager = ToolManager.getInstance();
			await toolManager.init();
			const aiToolManager = AIToolManager.getInstance();
			await aiToolManager.init();

			// 初始化内置工具配置
			const builtinTools = settingsState.builtinTools;
			if (builtinTools && builtinTools.length > 0) {
				await toolManager.updateBuiltinTools(builtinTools);
				await aiToolManager.updateBuiltinTools(builtinTools)
			}

			// 初始化MCP服务器配置（只有在有配置时才初始化）
			const mcpServers = settingsState.mcpServers;
			if (mcpServers && mcpServers.length > 0) {
				await toolManager.updateMCPServers(mcpServers);
				await aiToolManager.updateMCPServers(mcpServers);
			}

			// 初始化SubAgent配置（只有在有配置时才初始化）
			const subAgents = settingsState.subAgents;
			if (subAgents && subAgents.length > 0) {
				await toolManager.updateSubAgents(subAgents);
				await aiToolManager.updateSubAgents(subAgents);
			}
		} catch (error) {
			console.error('Failed to initialize tools:', error);
		}
	}
}
