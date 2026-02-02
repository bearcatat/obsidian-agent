import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { MCPServerConfig } from "../../types";
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tool, ToolSet } from "ai";
import React from "react";
import { ToolMessage } from "@/messages/tool-message";
import { MessageV2 } from "@/types";


export default class MCPManager {
  private configs: MCPServerConfig[] = [];
  private clients: Record<string, MCPClient> = {};

  async updateMCPServers(configs: MCPServerConfig[]) {
    this.configs = configs
    await Promise.all(
      configs.map(async config => {
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
      })
    )
    console.log("clients", this.clients)
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

  async getEnabledTools(): Promise<ToolSet> {
    const toolSet: ToolSet = {}
    await Promise.all(
      this.configs.map(async config => {
        const client = this.clients[config.name]
        if (client) {
          const clientTools = await getClientEnabledTools(client, config)
          Object.entries(clientTools).forEach(([k, v]) => {
            toolSet[k] = v
          })
        }
      })
    )
    console.log("enabled mcp tool", toolSet)
    return toolSet
  }

  async getTools(config: MCPServerConfig): Promise<ToolSet> {
    return await this.clients[config.name].tools()
  }
}

async function getClientEnabledTools(client: MCPClient, config: MCPServerConfig): Promise<ToolSet> {
  const clientToolSet = await client.tools()
  console.log("client mcp", config, clientToolSet)
  const enabledTools = Object.entries(clientToolSet)
    .filter(([k, v]) => {
      if (!config.tools) {
        return false
      }
      const toolConfig = config.tools.find(t => t.name == k)
      if (toolConfig) {
        return true
      }
      return false
    })
    .map(([k, v]) => [k, tool({
      title: v.title ?? k,
      description: v.description,
      inputSchema: v.inputSchema,
      execute: async (input, options) => {
        const context = options.experimental_context as { addMessage: (message: MessageV2) => void }
        const toolMessage = ToolMessage.from(k, options.toolCallId)
        toolMessage.setChildren(render(k))
        toolMessage.close()
        context.addMessage(toolMessage)
        return await v.execute(input, options)
      }
    })])
  return Object.fromEntries(enabledTools)
}

function render(name: string): React.ReactNode {
  return (
    `MCPToolAdaptor: ${name}`
  )
}