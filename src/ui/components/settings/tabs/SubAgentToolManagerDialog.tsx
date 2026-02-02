import { Button } from "@/ui/elements/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/elements/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { useState, useEffect } from "react";
import { SubAgentConfig, SubAgentToolConfig, BuiltinToolConfig } from "@/types";
import { useSettingsLogic, useSettingsState } from "@/hooks/use-settings";

interface SubAgentToolManagerDialogProps {
  subAgent: SubAgentConfig;
  open: boolean;
  close: () => void;
}

export const SubAgentToolManagerDialog: React.FC<SubAgentToolManagerDialogProps> = ({
  subAgent,
  open,
  close,
}) => {
  const { addOrUpdateSubAgent, getAIMCPTools } = useSettingsLogic();
  const { builtinTools, mcpServers, subAgents } = useSettingsState();

  const [tools, setTools] = useState<SubAgentToolConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载工具列表
  useEffect(() => {
    if (open && subAgent) {
      loadTools();
    }
  }, [open, subAgent]);

  const loadTools = async () => {
    setLoading(true);
    setError(null);

    try {
      // 获取所有可用的内置工具
      const availableBuiltinTools = builtinTools.map(tool => ({
        type: "builtin",
        name: tool.name,
        enabled: false // 默认禁用
      } as SubAgentToolConfig));

      const availableMcpTools: SubAgentToolConfig[] = [];
      for (const server of mcpServers) {
        const tools = Object.entries(await getAIMCPTools(server));
        availableMcpTools.push(...tools.map(([k, v]) => ({
          type: "mcp",
          name: k,
          enabled: false // 默认禁用
        } as SubAgentToolConfig)));
      }

      // const availableSubAgentTools: SubAgentToolConfig[] = [];
      // for (const sa of subAgents) {
      //   if (sa.name === subAgent.name) {
      //     continue;
      //   }
      //   availableSubAgentTools.push({
      //     type: "subAgent",
      //     name: sa.name,
      //     enabled: false // 默认禁用
      //   } as SubAgentToolConfig);
      // }

      const availableTools = [...availableBuiltinTools, ...availableMcpTools];

      // 合并现有配置
      const toolConfigs: SubAgentToolConfig[] = availableTools.map(tool => {
        // 检查是否已有配置
        const existingConfig = subAgent.tools?.find(t => t.name === tool.name && t.type === tool.type);
        return {
          type: tool.type,
          name: tool.name,
          enabled: existingConfig?.enabled ?? false // 默认禁用
        };
      });

      setTools(toolConfigs);
    } catch (err) {
      console.error('Failed to load SubAgent tools:', err);
      setError('Failed to load tools. Please check your configuration.');
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
      const updatedSubAgent = { ...subAgent, tools };
      await addOrUpdateSubAgent(updatedSubAgent, subAgent.name);
      close();
    } catch (error) {
      console.error('Failed to save tool configuration:', error);
      setError('Failed to save tool configuration.');
    }
  };

  const enabledCount = tools.filter(tool => tool.enabled).length;
  const totalCount = tools.length;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="tw-max-w-4xl tw-max-h-[80vh] tw-overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Manage Tools for "{subAgent.name}"
          </DialogTitle>
        </DialogHeader>

        <div className="tw-space-y-4">
          {loading ? (
            <div className="tw-text-center tw-py-8">Loading tools...</div>
          ) : error ? (
            <div className="tw-text-red-500 tw-text-center tw-py-8">{error}</div>
          ) : (
            <>
              {/* Tool Count and Actions */}
              <div className="tw-flex tw-justify-between tw-items-center">
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

              {/* Tools Table */}
              <div className="tw-border tw-rounded-lg tw-overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="tw-w-12">Enabled</TableHead>
                      <TableHead>Tool Name</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tools.map((tool) => (
                      <TableRow key={tool.name}>
                        <TableCell>
                          <SettingSwitch
                            checked={tool.enabled}
                            onCheckedChange={(checked) => handleToolToggle(tool.name, checked)}
                          />
                        </TableCell>
                        <TableCell className="tw-font-medium">{tool.name}</TableCell>
                        <TableCell className="tw-text-gray-600">{tool.type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Action Buttons */}
              <div className="tw-flex tw-justify-end tw-gap-2 tw-pt-4">
                <Button variant="secondary" onClick={close}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save Configuration
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
