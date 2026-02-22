import { MCPServerAddOrUpdateDialog } from "./MCPServerAddOrUpdateDialog";
import { MCPToolManagerDialog } from "./MCPToolManagerDialog";
import { BuiltinToolTable } from "./builtin-tool-table";
import { ExternalToolsTable, ExternalToolId } from "./external-tools-table";
import { ExternalToolDialog } from "./external-tool-dialog";
import { useState } from "react";
import { MCPServerTable } from "./mcp-server-table";
import { MCPServerConfig } from "@/types";

export const ToolSetting: React.FC = () => {

  const _initialServer = {
    name: "",
    transport: "stdio" as const,
    command: "",
    args: [],
    headers: {},
  } as MCPServerConfig;

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showToolManagerDialog, setShowToolManagerDialog] = useState(false);
  const [initialServer, setInitialServer] = useState<MCPServerConfig>(_initialServer);
  const [selectedServer, setSelectedServer] = useState<MCPServerConfig | null>(null);
  const [isUpdate, setIsUpdate] = useState(false);

  const [showExternalToolDialog, setShowExternalToolDialog] = useState(false);
  const [selectedExternalTool, setSelectedExternalTool] = useState<ExternalToolId | null>(null);

  const handleEditExternalTool = (toolId: ExternalToolId) => {
    setSelectedExternalTool(toolId);
    setShowExternalToolDialog(true);
  };

  return (
    <div className="tw-space-y-8">
      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">Builtin Tools</div>
        <BuiltinToolTable />
      </section>

      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">External Tools</div>
        <ExternalToolsTable onEdit={handleEditExternalTool} />
        <ExternalToolDialog
          toolId={selectedExternalTool}
          open={showExternalToolDialog}
          close={() => {
            setShowExternalToolDialog(false);
            setSelectedExternalTool(null);
          }}
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
          onManageTools={(server) => {
            setSelectedServer(server);
            setShowToolManagerDialog(true);
          }}
        />
        <MCPServerAddOrUpdateDialog
          initialServer={initialServer}
          isUpdate={isUpdate}
          open={showAddDialog}
          close={() => setShowAddDialog(false)}
        />
        {selectedServer && (
          <MCPToolManagerDialog
            server={selectedServer}
            open={showToolManagerDialog}
            close={() => {
              setShowToolManagerDialog(false);
              setSelectedServer(null);
            }}
          />
        )}
      </section>
    </div>
  );
};
