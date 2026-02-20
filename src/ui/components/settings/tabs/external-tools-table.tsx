import { Button } from "@/ui/elements/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { Pencil } from "lucide-react";
import React from "react";
import { useSettingsState } from "@/hooks/use-settings";

export type ExternalToolId = "exa" | "bocha";

interface ExternalTool {
  id: ExternalToolId;
  name: string;
  description: string;
  enabled: boolean;
  hasApiKey: boolean;
  getLink: string;
}

interface ExternalToolsTableProps {
  onEdit: (toolId: ExternalToolId) => void;
}

export const ExternalToolsTable: React.FC<ExternalToolsTableProps> = ({ onEdit }) => {
  const { exaSearchConfig, bochaSearchConfig } = useSettingsState();

  const externalTools: ExternalTool[] = [
    {
      id: "exa",
      name: "Exa Web Search",
      description: "Search the web using Exa AI",
      enabled: exaSearchConfig.enabled && !!exaSearchConfig.apiKey,
      hasApiKey: !!exaSearchConfig.apiKey,
      getLink: "https://dashboard.exa.ai/api-keys",
    },
    {
      id: "bocha",
      name: "Bocha Web Search",
      description: "Search the web using Bocha AI",
      enabled: bochaSearchConfig.enabled && !!bochaSearchConfig.apiKey,
      hasApiKey: !!bochaSearchConfig.apiKey,
      getLink: "https://open.bochaai.com",
    },
  ];

  return (
    <div className="tw-mb-4">
      <div className="tw-hidden md:tw-block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="tw-w-32">Status</TableHead>
              <TableHead className="tw-w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {externalTools.map((tool) => (
              <TableRow key={tool.id}>
                <TableCell className="tw-font-medium">{tool.name}</TableCell>
                <TableCell className="tw-text-gray-600">{tool.description}</TableCell>
                <TableCell>
                  <div className="tw-flex tw-items-center tw-gap-2">
                    <div
                      className={`tw-w-2 tw-h-2 tw-rounded-full ${
                        tool.enabled
                          ? "tw-bg-green-500"
                          : tool.hasApiKey
                          ? "tw-bg-yellow-500"
                          : "tw-bg-gray-400"
                      }`}
                    />
                    <span className="tw-text-sm tw-text-gray-600">
                      {tool.enabled
                        ? "Enabled"
                        : tool.hasApiKey
                        ? "Disabled"
                        : "Not configured"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(tool.id)}
                    className="tw-shadow-sm tw-transition-shadow hover:tw-shadow-md"
                  >
                    <Pencil className="tw-size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile view */}
      <div className="md:tw-hidden tw-space-y-3">
        {externalTools.map((tool) => (
          <div
            key={tool.id}
            className="tw-p-4 tw-border tw-border-gray-200 tw-rounded-lg tw-space-y-2"
          >
            <div className="tw-flex tw-items-center tw-justify-between">
              <div className="tw-font-medium">{tool.name}</div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(tool.id)}
              >
                <Pencil className="tw-size-4" />
              </Button>
            </div>
            <div className="tw-text-sm tw-text-gray-600">{tool.description}</div>
            <div className="tw-flex tw-items-center tw-gap-2">
              <div
                className={`tw-w-2 tw-h-2 tw-rounded-full ${
                  tool.enabled
                    ? "tw-bg-green-500"
                    : tool.hasApiKey
                    ? "tw-bg-yellow-500"
                    : "tw-bg-gray-400"
                }`}
              />
              <span className="tw-text-sm tw-text-gray-600">
                {tool.enabled
                  ? "Enabled"
                  : tool.hasApiKey
                  ? "Disabled"
                  : "Not configured"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
