import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import MCPToolAdaptor from "./MCPToolAdaptor";
import { MCPServerConfig } from "../../types";

export default class MCPManager {
  private client: MultiServerMCPClient | null = null;

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
      } else if (server.transport === "http" || server.transport === "sse") {
        serverConfig.url = server.url;
        // 添加headers配置
        if (server.headers && Object.keys(server.headers).length > 0) {
          serverConfig.headers = server.headers;
        }
      }

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

  async getTools(): Promise<MCPToolAdaptor[]> {
    if (!this.client) {
      return [];
    }
    
    try {
      const tools = await this.client.getTools();
      console.log("mcp tools", tools);
      return tools.map(tool => new MCPToolAdaptor(tool));
    } catch (error) {
      console.error("Failed to get MCP tools:", error);
      return [];
    }
  }
}