import { useSettingsLogic, useSettingsState } from "@/hooks/use-settings";
import { SettingItem } from "@/ui/elements/setting-item";
import { MCPServerAddOrUpdateDialog } from "./MCPServerAddOrUpdateDialog";
import { useState } from "react";
import { MCPServerTable } from "./mcp-server-table";
import { MCPServerConfig } from "@/types";

export const ToolSetting: React.FC = () => {
  const { bochaaiApiKey } = useSettingsState();
  const { setBochaaiApiKey } = useSettingsLogic();

  const _initialServer = {
    name: "",
    transport: "stdio" as const,
    command: "",
    args: [],
    headers: {},
  } as MCPServerConfig;

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [initialServer, setInitialServer] = useState<MCPServerConfig>(_initialServer);
  const [isUpdate, setIsUpdate] = useState(false);

  return (
    <div className="tw-space-y-6">
      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">Tools</div>
        <SettingItem
          type="text"
          title="Bochaai API Key"
          description="The API key for Bochaai"
          value={bochaaiApiKey}
          onChange={(value) => setBochaaiApiKey(value)}
        />
      </section>

      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">MCP Servers</div>
        <MCPServerTable
          onEdit={(server) => {
            setInitialServer(server);
            setIsUpdate(true);
            setShowAddDialog(true);
          }}
          onAdd={() => {
            setInitialServer(_initialServer);
            setIsUpdate(false);
            setShowAddDialog(true);
          }}
        />
        <MCPServerAddOrUpdateDialog
          initialServer={initialServer}
          isUpdate={isUpdate}
          open={showAddDialog}
          close={() => setShowAddDialog(false)}
        />
      </section>
    </div>
  );
};