import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { MessageV2 } from "@/types";
import { isBuiltinCommand } from "@/logic/builtin-commands";
import CommandLogic from "@/logic/command-logic";

export const toolName = "createCommand";

interface CreateCommandResult {
  name: string;
  description: string;
  file_path: string;
  is_new_file: boolean;
  content: string;
}

function formatCommandFile(name: string, description: string, template: string): string {
  return `---
name: ${name}
description: ${description}
---
${template}`;
}

export const CreateCommandTool = tool({
  title: toolName,
  description: DESCRIPTION,
  inputSchema: z.object({
    name: z.string().describe("Command name (lowercase, use underscores for spaces)"),
    description: z.string().describe("Brief description of what the command does"),
    template: z.string().describe("The prompt template content"),
  }),
  execute: async ({ name, description, template }, { toolCallId, experimental_context }) => {
    const context = experimental_context as { addMessage: (message: MessageV2) => void };
    
    try {
      const toolMessage = ToolMessage.from(toolName, toolCallId);
      const app = getGlobalApp();
      const vault = app.vault;

      const commandName = name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      if (!commandName) {
        toolMessage.setContent(JSON.stringify({
          error: "Invalid command name",
          message: "Command name must contain at least one alphanumeric character",
        }));
        context.addMessage(toolMessage);
        return JSON.stringify({ error: "Invalid command name" });
      }

      if (isBuiltinCommand(commandName)) {
        toolMessage.setContent(JSON.stringify({
          error: "Cannot override builtin command",
          message: `Command "${commandName}" is a builtin command and cannot be overridden`,
        }));
        context.addMessage(toolMessage);
        return JSON.stringify({ error: "Cannot override builtin command" });
      }

      const existingCommands = CommandLogic.getInstance().getCommands();
      const existingCommand = existingCommands.find(cmd => cmd.name === commandName);

      const filePath = `obsidian-agent/commands/${commandName}.md`;
      const content = formatCommandFile(commandName, description, template);

      const result: CreateCommandResult = {
        name: commandName,
        description,
        file_path: filePath,
        is_new_file: !existingCommand,
        content,
      };

      let resolver: (value: "apply" | "reject") => void;
      const waitForDecision = () => new Promise<"apply" | "reject">((resolve) => { resolver = resolve; });
      const handleApply = () => { resolver("apply"); };
      const handleReject = () => { resolver("reject"); };

      toolMessage.setChildren(render(result, false, null, handleApply, handleReject));
      context.addMessage(toolMessage);

      const decision = await waitForDecision();

      if (decision === "apply") {
        try {
          const dirPath = 'obsidian-agent/commands';
          const dirExists = await vault.adapter.exists(dirPath);
          if (!dirExists) {
            await vault.adapter.mkdir(dirPath);
          }

          const file = vault.getAbstractFileByPath(filePath);
          if (file) {
            await vault.modify(file as any, content);
          } else {
            await vault.create(filePath, content);
          }

          await CommandLogic.getInstance().loadCommands();
        } catch (error) {
          toolMessage.setContent(JSON.stringify({
            error: "Failed to create command",
            details: error instanceof Error ? error.message : "unknown error",
          }));
          context.addMessage(toolMessage);
          return JSON.stringify({ error: "Failed to create command" });
        }
      } else {
        toolMessage.setContent(JSON.stringify({
          cancelled: true,
          message: "User rejected the command creation",
        }));
      }

      toolMessage.setChildren(render(result, true, decision, handleApply, handleReject));
      toolMessage.close();
      context.addMessage(toolMessage);

      return JSON.stringify({
        success: decision === "apply",
        name: commandName,
        file_path: filePath,
        message: decision === "apply" 
          ? `Command "/${commandName}" created successfully`
          : "User rejected",
      });
    } catch (error) {
      const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error);
      context.addMessage(errorMessage);
      throw error;
    }
  }
});

function render(
  result: CreateCommandResult,
  answered: boolean,
  decision: "apply" | "reject" | null,
  onApply: () => void,
  onReject: () => void
): React.ReactNode {
  return (
    <div className="tw-p-3 tw-border tw-rounded-lg tw-bg-muted/30">
      <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
        <span className="tw-text-lg">📝</span>
        <span className="tw-font-medium">
          {result.is_new_file ? 'Create Command' : 'Update Command'}
        </span>
        {answered && (
          <span className={`tw-ml-auto tw-text-sm ${decision === 'apply' ? 'tw-text-green-600' : 'tw-text-red-600'}`}>
            {decision === 'apply' ? '✓ Applied' : '✗ Rejected'}
          </span>
        )}
      </div>
      
      <div className="tw-space-y-1 tw-text-sm tw-mb-3">
        <div>
          <span className="tw-text-muted-foreground">Command:</span>{' '}
          <code className="tw-px-1 tw-bg-muted tw-rounded">/{result.name}</code>
        </div>
        <div>
          <span className="tw-text-muted-foreground">Description:</span> {result.description}
        </div>
        <div>
          <span className="tw-text-muted-foreground">File:</span>{' '}
          <code className="tw-px-1 tw-bg-muted tw-rounded tw-text-xs">{result.file_path}</code>
        </div>
      </div>

      <details className="tw-mb-3">
        <summary className="tw-cursor-pointer tw-text-sm tw-text-muted-foreground hover:tw-text-normal">
          Preview content
        </summary>
        <pre className="tw-mt-2 tw-p-2 tw-bg-muted tw-rounded tw-text-xs tw-overflow-x-auto tw-whitespace-pre-wrap">
          {result.content}
        </pre>
      </details>

      {!answered && (
        <div className="tw-flex tw-gap-2 tw-justify-end">
          <button
            onClick={onReject}
            className="tw-px-3 tw-py-1 tw-text-sm tw-rounded tw-bg-destructive tw-text-on-accent hover:tw-opacity-80"
          >
            Reject
          </button>
          <button
            onClick={onApply}
            className="tw-px-3 tw-py-1 tw-text-sm tw-rounded tw-bg-interactive-accent tw-text-on-accent hover:tw-opacity-80"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
