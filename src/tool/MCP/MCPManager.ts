import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { MCPServerConfig } from "../../types";
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ToolSet } from "ai";
import { getAdaptedMCPTools } from "../adapters/MCPToolAdapter";


export default class MCPManager {
  private configs: MCPServerConfig[] = [];
  private clients: Record<string, MCPClient> = {};

  async updateMCPServers(configs: MCPServerConfig[]) {
    this.configs = configs
    await Promise.all(
      configs.map(async config => {
        try {
          let mcpClient: MCPClient
          switch (config.transport) {
            case "stdio":
              mcpClient = await this.buildStdioClient(config)
              break
            case "http":
              mcpClient = await this.buildHttpClient(config)
              break
            case "sse":
              mcpClient = await this.buildSSEClient(config)
              break
            default:
              throw new Error(`Unknown transport type: ${config.transport}`)
          }
          this.clients[config.name] = mcpClient
        } catch (error) {
          console.error(`Failed to initialize MCP server "${config.name}":`, error)
          // 不中断其他服务器的初始化
        }
      })
    )
  }

  async buildStdioClient(config: MCPServerConfig): Promise<MCPClient> {
    return await createMCPClient({
      transport: new StdioClientTransport({
        command: config.command ?? "",
        args: config.args,
        env: config.env,
      })
    })
  }

  async buildHttpClient(config: MCPServerConfig): Promise<MCPClient> {
    return await createMCPClient({
      transport: {
        type: "http",
        url: config.url ?? "",
        headers: config.headers,
      }
    })
  }

  async buildSSEClient(config: MCPServerConfig): Promise<MCPClient> {
    return await createMCPClient({
      transport: {
        type: "sse",
        url: config.url ?? "",
        headers: config.headers,
      }
    })
  }

  async getTools(isEnabled: boolean): Promise<ToolSet> {
    const toolSet: ToolSet = {}
    await Promise.all(
      this.configs.map(async config => {
        const client = this.clients[config.name]
        if (client) {
          const clientTools = await getAdaptedMCPTools(client, config, isEnabled)
          Object.entries(clientTools).forEach(([k, v]) => {
            toolSet[k] = v
          })
        }
      })
    )
    return toolSet
  }

  async getClientTools(config: MCPServerConfig): Promise<ToolSet> {
    return await this.clients[config.name].tools()
  }

  async dispose() {
    await Promise.all(
      Object.entries(this.clients).map(async ([, v]) => {
        await v.close()
      })
    )
    this.clients = {};
  }
}
