import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import MCPToolAdaptor from "./MCPToolAdaptor";
import { MCPServerConfig } from "../../types";

export default class MCPManager {
  private client: MultiServerMCPClient | null = null;
  private servers: MCPServerConfig[] = [];

  constructor() {
    // 不在构造函数中创建客户端，而是在有配置时创建
  }

  closeClient() {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  // 更新MCP服务器配置
  updateMCPServers(servers: MCPServerConfig[]): void {
    this.servers = servers;
    // 构建mcpServers配置对象
    const mcpServersConfig: Record<string, any> = {};

    servers.forEach(server => {
      const serverConfig: any = {
        transport: server.transport,
        restart: {
          enabled: true,
          maxAttempts: 3,
          delayMs: 1000,
        },
      };

      if (server.transport === "stdio") {
        serverConfig.command = server.command;
        serverConfig.args = server.args;
        // 添加环境变量配置
        if (server.env && Object.keys(server.env).length > 0) {
          serverConfig.env = server.env;
        }
      } else if (server.transport === "http" || server.transport === "sse") {
        serverConfig.url = server.url;
        // 添加headers配置
        if (server.headers && Object.keys(server.headers).length > 0) {
          serverConfig.headers = server.headers;
        }
      }
      console.log("serverConfig", serverConfig);
      mcpServersConfig[server.name] = serverConfig;
    });

    // 只有在有服务器配置时才创建客户端
    if (Object.keys(mcpServersConfig).length > 0) {
      this.closeClient();
      this.client = new MultiServerMCPClient({
        throwOnLoadError: true,
        prefixToolNameWithServerName: false,
        useStandardContentBlocks: true,
        mcpServers: mcpServersConfig
      });
    } else {
      this.client = null;
    }
  }

  // 根据配置获取启用的工具
  async getEnabledTools(): Promise<MCPToolAdaptor[]> {
    if (!this.client) {
      return [];
    }

    try {
      const allTools = await this.client.getTools();
      const enabledTools: MCPToolAdaptor[] = [];

      // 为每个服务器过滤启用的工具
      this.servers.forEach(server => {
        if (server.tools) {
          server.tools.forEach(toolConfig => {
            if (toolConfig.enabled) {
              const tool = allTools.find(t => t.name === toolConfig.name);
              if (tool) {
                enabledTools.push(new MCPToolAdaptor(tool));
              }
            }
          });
        }
      });

      return enabledTools;
    } catch (error) {
      console.error("Failed to get enabled MCP tools:", error);
      return [];
    }
  }
}