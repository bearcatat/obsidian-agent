import React, { useCallback, useEffect, useState } from "react";
import { useTab } from "@/hooks/TabContext";
import { MCPServerConfig, MCPTransportTypes } from "@/types";
import { Input } from "@/ui/elements/input";
import { Button } from "@/ui/elements/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/elements/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { FormField } from "@/ui/elements/form-field";
import { Textarea } from "@/ui/elements/textarea";
import { debounce } from "@/ui/components/utils";
import { useSettingsLogic } from "@/hooks/use-settings";

interface MCPServerAddOrUpdateDialogProps {
  initialServer: MCPServerConfig;
  isUpdate: boolean;
  open: boolean;
  close: () => void;
}

export const MCPServerAddOrUpdateDialog: React.FC<MCPServerAddOrUpdateDialogProps> = ({
  initialServer,
  isUpdate,
  open,
  close,
}) => {
  const { modalContainer } = useTab();
  const [dialogElement, setDialogElement] = useState<HTMLDivElement | null>(null);

  const [server, setServer] = useState<MCPServerConfig>(initialServer);
  const [headersString, setHeadersString] = useState<string>("");
  const { addOrUpdateMCPServer } = useSettingsLogic();

  useEffect(() => {
    setServer(initialServer);
    setHeadersString(formatHeadersForDisplay(initialServer.headers));
  }, [initialServer]);

  // Clean up server data by trimming whitespace
  const getCleanedServer = (serverData: MCPServerConfig): MCPServerConfig => {
    return {
      ...serverData,
      name: serverData.name?.trim(),
      command: serverData.command?.trim(),
      url: serverData.url?.trim(),
    };
  };

  const onSave = async () => {
    // 解析headers字符串
    const headers: Record<string, string> = {};
    if (headersString.trim()) {
      const lines = headersString.split('\n');
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.includes(':')) {
          const [key, ...valueParts] = trimmedLine.split(':');
          const value = valueParts.join(':').trim();
          if (key.trim() && value) {
            headers[key.trim()] = value;
          }
        }
      });
    }

    const cleanedServer = getCleanedServer({
      ...server,
      headers: Object.keys(headers).length > 0 ? headers : undefined
    });
    
    try {
      if (isUpdate) {
        // 更新模式：传递原始名称
        await addOrUpdateMCPServer(cleanedServer, initialServer.name);
      } else {
        // 添加模式：不传递原始名称
        await addOrUpdateMCPServer(cleanedServer);
      }
      close();
    } catch (error) {
      console.error('Failed to save MCP server:', error);
    }
  };
    
  const handleTransportChange = (transport: string) => {
    // 根据transport类型重置相关字段
    if (transport === "stdio") {
      setServer({
        ...server,
        transport: "stdio" as const,
        command: "",
        args: [],
        url: undefined,
        headers: undefined,
      });
    } else if (transport === "http" || transport === "sse") {
      setServer({
        ...server,
        transport: transport as "http" | "sse",
        command: undefined,
        args: undefined,
        url: "",
        headers: {},
      });
    }
  };

  const handleArgsChange = (argsString: string) => {
    const args = argsString.split(" ").filter(arg => arg.trim() !== "");
    setServer({ ...server, args });
  };

  const handleHeadersChange = (headersString: string) => {
    setHeadersString(headersString);
  };

  const formatHeadersForDisplay = (headers: Record<string, string> | undefined): string => {
    if (!headers || Object.keys(headers).length === 0) {
      return '';
    }
    return Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="sm:tw-max-w-[425px]"
        container={modalContainer}
        ref={(el: HTMLDivElement | null) => setDialogElement(el)}
      >
        <DialogHeader>
          <DialogTitle>{isUpdate ? "Update MCP Server" : "Add MCP Server"}</DialogTitle>
          <DialogDescription>
            {isUpdate ? "Update existing MCP server configuration." : "Add a new MCP server configuration."}
          </DialogDescription>
        </DialogHeader>

        <div className="tw-space-y-3">
          <FormField
            label="Server Name"
            required
          >
            <Input
              type="text"
              placeholder="Enter server name"
              value={server.name || ""}
              onChange={(e) => setServer({ ...server, name: e.target.value })}
            />
          </FormField>

          <FormField label="Transport Type">
            <Select 
              value={server.transport} 
              onValueChange={handleTransportChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select transport type" />
              </SelectTrigger>
              <SelectContent container={dialogElement}>
                {Object.values(MCPTransportTypes).map((transport) => (
                  <SelectItem key={transport} value={transport}>
                    {transport.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {server.transport === "stdio" && (
            <>
              <FormField
                label="Command"
                required
              >
                <Input
                  type="text"
                  placeholder="Enter command (e.g., npx)"
                  value={server.command || ""}
                  onChange={(e) => setServer({ ...server, command: e.target.value })}
                />
              </FormField>

              <FormField
                label="Arguments"
              >
                <Input
                  type="text"
                  placeholder="Enter arguments separated by spaces (e.g., @playwright/mcp@latest)"
                  value={server.args?.join(" ") || ""}
                  onChange={(e) => handleArgsChange(e.target.value)}
                />
              </FormField>
            </>
          )}

          {(server.transport === "http" || server.transport === "sse") && (
            <>
              <FormField
                label="Server URL"
                required
              >
                <Input
                  type="url"
                  placeholder={
                    server.transport === "sse" 
                      ? "Enter SSE server URL (e.g., http://localhost:3000/events)"
                      : "Enter server URL (e.g., http://localhost:3000)"
                  }
                  value={server.url || ""}
                  onChange={(e) => setServer({ ...server, url: e.target.value })}
                />
              </FormField>

              <FormField
                label="Headers (Optional)"
              >
                <Textarea
                  placeholder={
                    server.transport === "sse"
                      ? "Enter headers in format:&#10;Authorization: Bearer token&#10;Content-Type: text/event-stream"
                      : "Enter headers in format:&#10;Authorization: Bearer token&#10;Content-Type: application/json"
                  }
                  value={headersString}
                  onChange={(e) => handleHeadersChange(e.target.value)}
                  rows={4}
                />
                <div className="tw-text-xs tw-text-gray-500 tw-mt-1">
                  Format: Key: Value (one per line)
                </div>
              </FormField>
            </>
          )}
        </div>

        <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-6">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            {isUpdate ? "Update" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
