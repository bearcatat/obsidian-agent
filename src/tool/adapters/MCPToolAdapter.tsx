import { tool, ToolSet } from "ai";
import React from "react";
import { MCPClient } from "@ai-sdk/mcp";
import { MessageV2, MCPServerConfig } from "@/types";
import { ToolMessage } from "@/messages/tool-message";

export async function getAdaptedMCPTools(client: MCPClient, config: MCPServerConfig, isEnabled: boolean): Promise<ToolSet> {
  const clientToolSet = await client.tools();
  const enabledTools = Object.entries(clientToolSet)
    .filter(([toolName]) => {
      if (!config.tools) {
        return false;
      }

      return config.tools.some((toolConfig) => {
        if (!isEnabled) {
          return toolConfig.name === toolName;
        }

        return toolConfig.name === toolName && toolConfig.enabled;
      });
    })
    .map(([toolName, clientTool]) => [toolName, tool({
      title: toolName,
      description: clientTool.description,
      inputSchema: clientTool.inputSchema,
      execute: async (input, options) => {
        const context = options.experimental_context as { addMessage: (message: MessageV2) => void };
        const toolMessage = ToolMessage.from(toolName, options.toolCallId);
        toolMessage.setChildren(render(toolName));
        toolMessage.close();
        context.addMessage(toolMessage);
        return await clientTool.execute(input, options);
      }
    })]);

  return Object.fromEntries(enabledTools);
}

function render(name: string): React.ReactNode {
  return `MCPToolAdaptor: ${name}`;
}
