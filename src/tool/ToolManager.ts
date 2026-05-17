import { ToolSet } from "ai";
import { BuiltinToolConfig, MCPServerConfig, ExaSearchConfig, BochaSearchConfig, TelegramFeedbackConfig } from "../types";
import MCPManager from "./MCP/MCPManager";
import SubAgentManager from "./SubAgent/SubAgentManager";
import BuiltinToolProvider from "./providers/BuiltinToolProvider";
import ExaSearchToolProvider from "./providers/ExaSearchToolProvider";
import BochaSearchToolProvider from "./providers/BochaSearchToolProvider";
import TelegramFeedbackToolProvider from "./providers/TelegramFeedbackToolProvider";
import MCPToolProvider from "./providers/MCPToolProvider";
import SubAgentToolProvider from "./providers/SubAgentToolProvider";
import { ToolProvider } from "./ToolProvider";


export default class AIToolManager {
  private static instance: AIToolManager;
  private mainAgentEnableTools: ToolSet = {};
  private readonly builtinToolProvider = new BuiltinToolProvider();
  private readonly mcpToolProvider = new MCPToolProvider(new MCPManager());
  private readonly subAgentToolProvider = new SubAgentToolProvider(new SubAgentManager());
  private readonly exaSearchToolProvider = new ExaSearchToolProvider();
  private readonly bochaSearchToolProvider = new BochaSearchToolProvider();
  private readonly telegramFeedbackToolProvider = new TelegramFeedbackToolProvider();
  private readonly baseProviders: ToolProvider[] = [
    this.builtinToolProvider,
    this.mcpToolProvider,
    this.exaSearchToolProvider,
    this.bochaSearchToolProvider,
    this.telegramFeedbackToolProvider,
  ];


  static getInstance(): AIToolManager {
    if (!AIToolManager.instance) {
      AIToolManager.instance = new AIToolManager();
    }
    return AIToolManager.instance;
  }

  static async resetInstance() {
    if (AIToolManager.instance) {
      await AIToolManager.instance.dispose();
    }
    AIToolManager.instance = undefined as any;
  }

  async init() {
    await this.refreshTools()
  }

  async updateBuiltinTools(toolConfigs: BuiltinToolConfig[]): Promise<void> {
    this.builtinToolProvider.updateConfigs(toolConfigs);
    await this.refreshTools();
  }

  async updateMCPServers(servers: MCPServerConfig[]): Promise<void> {
    await this.mcpToolProvider.updateServers(servers);
    await this.refreshTools();
  }

  async updateSubAgents(): Promise<void> {
    await this.refreshTools();
  }

  async updateExaSearchConfig(config: ExaSearchConfig): Promise<void> {
    this.exaSearchToolProvider.updateConfig(config);
    await this.refreshTools();
  }

  async updateBochaSearchConfig(config: BochaSearchConfig): Promise<void> {
    this.bochaSearchToolProvider.updateConfig(config);
    await this.refreshTools();
  }

  async updateTelegramFeedbackConfig(config: TelegramFeedbackConfig): Promise<void> {
    this.telegramFeedbackToolProvider.updateConfig(config);
    await this.refreshTools();
  }

  getMainAgentEnabledTools(): ToolSet {
    return this.mainAgentEnableTools;
  }

  private async refreshTools(): Promise<void> {
    const allTools = mergeToolSets(
      await Promise.all(this.baseProviders.map((provider) => provider.getAllTools?.({ allTools: {} }) ?? {}))
    );

    const enabledBaseTools = mergeToolSets(
      await Promise.all(this.baseProviders.map((provider) => provider.getEnabledTools({ allTools })))
    );

    this.mainAgentEnableTools = {
      ...enabledBaseTools,
      ...this.subAgentToolProvider.getEnabledTools({ allTools }),
    };
  }

  private async dispose(): Promise<void> {
    for (const provider of this.baseProviders) {
      await provider.dispose?.();
    }
  }

  async getMCPTools(server: MCPServerConfig): Promise<ToolSet> {
    return this.mcpToolProvider.getClientTools(server);
  }
}

function mergeToolSets(toolSets: ToolSet[]): ToolSet {
  return Object.assign({}, ...toolSets);
}
