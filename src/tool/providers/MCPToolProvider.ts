import { ToolSet } from "ai";
import { MCPServerConfig } from "@/types";
import { ToolProvider } from "../ToolProvider";
import { ToolContext } from "../ToolContext";
import MCPManager from "../MCP/MCPManager";

export default class MCPToolProvider implements ToolProvider {
  constructor(private readonly manager: MCPManager) {}

  async updateServers(configs: MCPServerConfig[]): Promise<void> {
    await this.manager.updateMCPServers(configs);
  }

  async getAllTools(_context: ToolContext): Promise<ToolSet> {
    return await this.manager.getTools(false);
  }

  async getEnabledTools(_context: ToolContext): Promise<ToolSet> {
    return await this.manager.getTools(true);
  }

  async getClientTools(server: MCPServerConfig): Promise<ToolSet> {
    return await this.manager.getClientTools(server);
  }

  async dispose(): Promise<void> {
    await this.manager.dispose();
  }
}
