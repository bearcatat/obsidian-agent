/// <reference types="node" />
import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { BashToolMessageCard } from "@/ui/components/agent-view/messages/message/bash-tool-message-card";
import { BashCommand, MessageV2, BashPermissionConfig, PermissionLevel } from "@/types";
import { settingsStore } from "@/state/settings-state-impl";
import { DEFAULT_BASH_PERMISSIONS } from "../BuiltinTools";
import { persistSettingsStore } from "@/logic/settings-persistence";
import { executeCommand } from "./execute-command";

export const toolName = "bash"

const BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'mkfs',
  'dd if=/dev/zero',
  ':(){:|:&};:',
  'chmod -R 777 /',
  'chown -R',
  '> /dev/sda',
  'mv / /dev/null',
  'wget | sh',
  'curl | sh',
];

const BLOCKED_PATTERNS = [
  /^\s*rm\s+-rf?\s+\//,
  /^\s*rm\s+-rf?\s+\.\.\//,
  /^\s*dd\s+/,
  /^\s*mkfs\./,
  /:\s*\(\s*\)\s*\{\s*\|\s*:\s*&\s*\}\s*;/,
  /^\s*>\s*\//,
  /^\s*mv\s+\/\s+/,
  /chmod\s+-R\s+777\s+\//,
  /chown\s+-R\s+/,
  /\|\s*sh$/,
  /\|\s*bash$/,
];

function isCommandBlocked(command: string): boolean {
  const trimmedCmd = command.trim().toLowerCase();

  for (const blocked of BLOCKED_COMMANDS) {
    if (trimmedCmd.includes(blocked.toLowerCase())) {
      return true;
    }
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return true;
    }
  }

  return false;
}

function matchPattern(command: string, pattern: string): boolean {
  const regexPattern = "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$";
  const regex = new RegExp(regexPattern, "i");
  return regex.test(command);
}

function checkPermission(command: string, config: BashPermissionConfig | undefined): PermissionLevel {
  const permConfig = config || DEFAULT_BASH_PERMISSIONS;
  
  for (let i = permConfig.rules.length - 1; i >= 0; i--) {
    if (matchPattern(command, permConfig.rules[i].pattern)) {
      return permConfig.rules[i].permission;
    }
  }
  
  return permConfig.default;
}

export const BashTool = tool({
  title: toolName,
  description: DESCRIPTION,
  inputSchema: z.object({
    command: z.string().describe("The shell command to execute"),
    timeout: z.number().optional().describe("Timeout in milliseconds (default: 60000)"),
  }),
  execute: async ({ command, timeout }, { toolCallId, experimental_context }) => {
    const context = experimental_context as { addMessage: (message: MessageV2) => void }

    if (isCommandBlocked(command)) {
      const errorMessage = ToolMessage.createErrorToolMessage2(
        toolName,
        toolCallId,
        new Error("This command is blocked for security reasons")
      )
      context.addMessage(errorMessage)
      throw new Error("This command is blocked for security reasons")
    }

    const settingsState = settingsStore.getState();
    const permissionConfig = settingsState.bashPermissions || DEFAULT_BASH_PERMISSIONS;
    const permission = checkPermission(command, permissionConfig);

    const toolMessage = ToolMessage.from(toolName, toolCallId)
    const app = getGlobalApp()
    const vault = app.vault

    let vaultPath = ''
    try {
      vaultPath = (vault.adapter as any).basePath || ''
    } catch (e) {
      vaultPath = ''
    }

    const bashCommand: BashCommand = {
      id: toolCallId ?? "",
      command,
      workingDirectory: vaultPath || "/",
    }

    if (permission === "deny") {
      const errorMessage = ToolMessage.createErrorToolMessage2(
        toolName,
        toolCallId,
        new Error(`Permission denied: This command pattern "${command}" is denied by permission rules`)
      )
      context.addMessage(errorMessage)
      throw new Error(`Permission denied: This command is blocked by permission rules`)
    }

    const executeAndRespond = async (cmd: string, decision: "apply" | "allow" | "reject") => {
      let result = { output: "", exitCode: 0, error: "" };
      
      try {
        result = await executeCommand(cmd, vaultPath, timeout);
      } catch (error) {
        toolMessage.setContent(JSON.stringify({
          error: "Command execution failed",
          details: error instanceof Error ? error.message : "unknown error",
        }));
        return { result, success: false };
      }

      const finalCommand: BashCommand = {
        ...bashCommand,
        output: result.output,
        exitCode: result.exitCode,
        error: result.error,
      };

      toolMessage.setContent(JSON.stringify({
        success: result.exitCode === 0 ? "Command executed successfully" : "Command failed",
        command: cmd,
        output: result.output,
        exitCode: result.exitCode,
        error: result.error,
      }));

      toolMessage.setChildren(render(finalCommand, true, decision, undefined, undefined, undefined, undefined));
      toolMessage.close();
      context.addMessage(toolMessage);

      return { 
        result, 
        success: result.exitCode === 0 
      };
    };

    if (permission === "allow") {
      const exitCodeResult = await executeCommand(command, vaultPath, timeout);
      const decision = exitCodeResult.exitCode === 0 ? "apply" : "reject";
      const { result } = await executeAndRespond(command, decision);
      return JSON.stringify({
        success: result.exitCode === 0 ? "Command executed successfully" : "Command failed",
        command,
        output: result.output,
        exitCode: result.exitCode,
        error: result.error,
      });
    }

    const updatePermissionRule = async (perm: PermissionLevel) => {
      const newRule = { pattern: command, permission: perm };
      const currentConfig = settingsStore.getState().bashPermissions || DEFAULT_BASH_PERMISSIONS;
      const existingIndex = currentConfig.rules.findIndex(r => r.pattern === command);
      let newRules = [...currentConfig.rules];
      if (existingIndex >= 0) {
        newRules[existingIndex] = newRule;
      } else {
        newRules.push(newRule);
      }
      const newConfig = { ...currentConfig, rules: newRules };
      settingsStore.getState().setBashPermissions(newConfig);
      await persistSettingsStore();
    };

    try {
      let resolver: (value: "apply" | "reject" | "allow" | "deny") => void
      const waitForDecision = () => new Promise<"apply" | "reject" | "allow" | "deny">((resolve) => { resolver = resolve })
      const handleApply = () => { resolver("apply") }
      const handleReject = () => { resolver("reject") }
      
      const handleAlwaysAllow = async () => {
        resolver("allow")
      }
      const handleAlwaysDeny = async () => {
        resolver("deny")
      }

      toolMessage.setChildren(render(bashCommand, false, null, handleApply, handleReject, handleAlwaysAllow, handleAlwaysDeny))
      context.addMessage(toolMessage)

      const decision = await waitForDecision()

      if (decision === "allow") {
        await updatePermissionRule("allow");
      } else if (decision === "deny") {
        await updatePermissionRule("deny");
      }

      if (decision === "apply" || decision === "allow") {
        const { result, success } = await executeAndRespond(command, decision);
        return JSON.stringify({
          success: success ? "Command executed successfully" : "Command failed",
          command,
          output: result.output,
          exitCode: result.exitCode,
          error: result.error,
        });
      }

      toolMessage.setContent(JSON.stringify({
        cancelled: true,
        message: decision === "deny" ? "User denied and remembered this command pattern" : "User rejected the command",
      }));
      toolMessage.setChildren(render(bashCommand, true, decision, undefined, undefined, undefined, undefined));
      toolMessage.close();
      context.addMessage(toolMessage);

      return JSON.stringify({
        success: "User rejected",
        command,
        output: "",
        exitCode: 0,
        error: "",
      });
    } catch (error) {
      const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
      context.addMessage(errorMessage)
      throw error
    }
  }
})

function render(
  bashCommand: BashCommand,
  origin_answered_state: boolean,
  decision: "apply" | "reject" | "allow" | "deny" | null,
  onApply?: () => void,
  onReject?: () => void,
  onAlwaysAllow?: () => void,
  onAlwaysDeny?: () => void
): React.ReactNode {
  return (
    <BashToolMessageCard
      bashCommand={bashCommand}
      origin_answered_state={origin_answered_state}
      decision={decision}
      onApply={onApply}
      onReject={onReject}
      onAlwaysAllow={onAlwaysAllow}
      onAlwaysDeny={onAlwaysDeny}
    />
  )
}
