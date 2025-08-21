import React, { useEffect, useState } from "react";
import { useTab } from "@/hooks/TabContext";
import { MCPToolConfig, MCPServerConfig } from "@/types";
import { Button } from "@/ui/elements/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/elements/dialog";
import { FormField } from "@/ui/elements/form-field";
import { Checkbox } from "@/ui/elements/checkbox";
import { useSettingsLogic } from "@/hooks/use-settings";
import ToolManager from "@/tools/ToolManager";

interface MCPToolManagerDialogProps {
  server: MCPServerConfig;
  open: boolean;
  close: () => void;
}

export const MCPToolManagerDialog: React.FC<MCPToolManagerDialogProps> = ({
  server,
  open,
  close,
}) => {
  const { modalContainer } = useTab();
  const { addOrUpdateMCPServer } = useSettingsLogic();
  
  const [tools, setTools] = useState<MCPToolConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载工具列表
  useEffect(() => {
    if (open && server) {
      loadTools();
    }
  }, [open, server]);

  const loadTools = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 创建临时MCPManager来获取工具
      const tempMCPManager = new (await import("@/tools/MCP/MCPManager")).default();
      
      // 创建临时配置
      const tempConfig: Record<string, any> = {};
      const serverConfig: any = {
        transport: server.transport,
        restart: { enabled: true, maxAttempts: 3, delayMs: 1000 },
      };

      if (server.transport === "stdio") {
        serverConfig.command = server.command;
        serverConfig.args = server.args;
        if (server.env && Object.keys(server.env).length > 0) {
          serverConfig.env = server.env;
        }
      } else if (server.transport === "http" || server.transport === "sse") {
        serverConfig.url = server.url;
        if (server.headers && Object.keys(server.headers).length > 0) {
          serverConfig.headers = server.headers;
        }
      }
      
      tempConfig[server.name] = serverConfig;
      
      // 创建客户端并获取工具
      const client = new (await import("@langchain/mcp-adapters")).MultiServerMCPClient({
        throwOnLoadError: true,
        prefixToolNameWithServerName: false,
        useStandardContentBlocks: true,
        mcpServers: tempConfig
      });

      const availableTools = await client.getTools();
      
      // 转换为MCPToolConfig格式
      const toolConfigs: MCPToolConfig[] = availableTools.map(tool => {
        // 检查是否已有配置
        const existingConfig = server.tools?.find(t => t.name === tool.name);
        return {
          name: tool.name,
          description: tool.description || "",
          enabled: existingConfig?.enabled ?? false // 默认禁用
        };
      });

      setTools(toolConfigs);
      
      // 清理
      client.close();
    } catch (err) {
      console.error('Failed to load MCP tools:', err);
      setError('Failed to load tools from MCP server. Please check your configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleToolToggle = (toolName: string, enabled: boolean) => {
    setTools(prev => prev.map(tool => 
      tool.name === toolName ? { ...tool, enabled } : tool
    ));
  };

  const handleSelectAll = () => {
    setTools(prev => prev.map(tool => ({ ...tool, enabled: true })));
  };

  const handleDeselectAll = () => {
    setTools(prev => prev.map(tool => ({ ...tool, enabled: false })));
  };

  const handleSave = async () => {
    try {
      const updatedServer = { ...server, tools };
      await addOrUpdateMCPServer(updatedServer, server.name);
      close();
    } catch (error) {
      console.error('Failed to save tool configuration:', error);
      setError('Failed to save tool configuration.');
    }
  };

  const enabledCount = tools.filter(tool => tool.enabled).length;
  const totalCount = tools.length;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="sm:tw-max-w-[600px]"
        container={modalContainer}
      >
        <DialogHeader>
          <DialogTitle>Manage Tools - {server.name}</DialogTitle>
          <DialogDescription>
            Select which tools from this MCP server should be available to the AI assistant.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="tw-flex tw-justify-center tw-py-8">
            <div className="tw-text-gray-500">Loading tools...</div>
          </div>
        )}

        {error && (
          <div className="tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-md tw-p-4 tw-mb-4">
            <div className="tw-text-red-800 tw-text-sm">{error}</div>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
              <div className="tw-text-sm tw-text-gray-600">
                {enabledCount} of {totalCount} tools enabled
              </div>
              <div className="tw-flex tw-gap-2">
                <Button variant="secondary" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDeselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="tw-space-y-3 tw-max-h-96 tw-overflow-y-auto">
              {tools.map((tool) => (
                <div key={tool.name} className="tw-flex tw-items-start tw-gap-3 tw-p-3 tw-border tw-rounded-md">
                  <Checkbox
                    checked={tool.enabled}
                    onCheckedChange={(checked) => handleToolToggle(tool.name, checked as boolean)}
                  />
                  <div className="tw-flex-1">
                    <div className="tw-font-medium tw-text-sm">{tool.name}</div>
                    {tool.description && (
                      <div className="tw-text-xs tw-text-gray-500 tw-mt-1">
                        {tool.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-6">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
