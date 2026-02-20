import { MCPServerAddOrUpdateDialog } from "./MCPServerAddOrUpdateDialog";
import { MCPToolManagerDialog } from "./MCPToolManagerDialog";
import { BuiltinToolTable } from "./builtin-tool-table";
import { SubAgentTable } from "./sub-agent-table";
import { SubAgentAddOrUpdateDialog } from "./SubAgentAddOrUpdateDialog";
import { SubAgentToolManagerDialog } from "./SubAgentToolManagerDialog";
import { ExternalToolsTable, ExternalToolId } from "./external-tools-table";
import { ExternalToolDialog } from "./external-tool-dialog";
import { useState } from "react";
import { MCPServerTable } from "./mcp-server-table";
import { MCPServerConfig, SubAgentConfig } from "@/types";

export const ToolSetting: React.FC = () => {

  const _initialServer = {
    name: "",
    transport: "stdio" as const,
    command: "",
    args: [],
    headers: {},
  } as MCPServerConfig;

  const _initialSubAgent = {
    name: "",
    systemPrompt: "",
    description: "",
    enabled: true,
    modelId: "",
    tools: [],
  } as SubAgentConfig;

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showToolManagerDialog, setShowToolManagerDialog] = useState(false);
  const [showSubAgentDialog, setShowSubAgentDialog] = useState(false);
  const [showSubAgentToolManagerDialog, setShowSubAgentToolManagerDialog] = useState(false);
  const [initialServer, setInitialServer] = useState<MCPServerConfig>(_initialServer);
  const [initialSubAgent, setInitialSubAgent] = useState<SubAgentConfig>(_initialSubAgent);
  const [selectedServer, setSelectedServer] = useState<MCPServerConfig | null>(null);
  const [selectedSubAgent, setSelectedSubAgent] = useState<SubAgentConfig | null>(null);
  const [isUpdate, setIsUpdate] = useState(false);
  const [isSubAgentUpdate, setIsSubAgentUpdate] = useState(false);

  // External Tools Dialog state
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

      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">SubAgents</div>
        <SubAgentTable
          onEdit={(subAgent) => {
            setInitialSubAgent(subAgent);
            setIsSubAgentUpdate(true);
            setShowSubAgentDialog(true);
          }}
          onAdd={() => {
            setInitialSubAgent(_initialSubAgent);
            setIsSubAgentUpdate(false);
            setShowSubAgentDialog(true);
          }}
          onManageTools={(subAgent) => {
            setSelectedSubAgent(subAgent);
            setShowSubAgentToolManagerDialog(true);
          }}
        />
        <SubAgentAddOrUpdateDialog
          initialSubAgent={initialSubAgent}
          isUpdate={isSubAgentUpdate}
          open={showSubAgentDialog}
          close={() => setShowSubAgentDialog(false)}
        />
        {selectedSubAgent && (
          <SubAgentToolManagerDialog
            subAgent={selectedSubAgent}
            open={showSubAgentToolManagerDialog}
            close={() => {
              setShowSubAgentToolManagerDialog(false);
              setSelectedSubAgent(null);
            }}
          />
        )}
      </section>
    </div>
  );
};
