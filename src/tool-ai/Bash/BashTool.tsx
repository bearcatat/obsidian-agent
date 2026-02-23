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

export const toolName = "bash"

const DEFAULT_TIMEOUT = 60000;
const MAX_OUTPUT_SIZE = 100 * 1024;

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

function getShellConfig(): { shell: string; args: string[]; encoding: BufferEncoding } {
  const isWindows = process.platform === 'win32';
  
  if (!isWindows) {
    return { shell: '/bin/bash', args: ['-c'], encoding: 'utf8' };
  }
  
  const shellEnv = process.env.SHELL;
  if (shellEnv && shellEnv.includes('bash')) {
    return { shell: shellEnv, args: ['-c'], encoding: 'utf8' };
  }
  
  // Windows cmd.exe: use /u for UTF-16LE output
  return { shell: 'cmd.exe', args: ['/u', '/c'], encoding: 'utf16le' };
}

async function executeCommand(command: string, cwd: string, timeout?: number): Promise<{ output: string; exitCode: number; error: string }> {
  const { spawn } = require('child_process');
  
  const { shell, args, encoding } = getShellConfig();
  const effectiveTimeout = timeout || DEFAULT_TIMEOUT;
  
  return new Promise((resolve) => {
    const child = spawn(shell, [...args, command], {
      cwd: cwd || undefined,
      shell: false,
      windowsHide: true,
    });

    const stdoutBuffers: Buffer[] = [];
    const stderrBuffers: Buffer[] = [];

    child.stdout?.on('data', (data: Buffer) => {
      stdoutBuffers.push(data);
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderrBuffers.push(data);
    });

    let timeoutHandle: NodeJS.Timeout | null = null;
    
    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    if (effectiveTimeout) {
      timeoutHandle = setTimeout(() => {
        child.kill('SIGKILL');
      }, effectiveTimeout);
    }

    child.on('close', (code: number | null) => {
      cleanup();
      
      const stdoutBuf = Buffer.concat(stdoutBuffers);
      const stderrBuf = Buffer.concat(stderrBuffers);
      
      let output = stdoutBuf.toString(encoding);
      let errorOutput = stderrBuf.toString(encoding);

      if (output.length > MAX_OUTPUT_SIZE) {
        output = output.substring(0, MAX_OUTPUT_SIZE) + '\n... (output truncated)';
      }

      if (code === null) {
        resolve({ output: 'Command timed out', exitCode: 124, error: 'Timeout' });
      } else {
        resolve({ output, exitCode: code || 0, error: errorOutput });
      }
    });

    child.on('error', (error: Error) => {
      cleanup();
      resolve({ output: '', exitCode: 1, error: error.message });
    });
  });
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

    if (permission === "allow") {
      try {
        const result = await executeCommand(command, vaultPath, timeout);
        
        const finalCommand: BashCommand = {
          ...bashCommand,
          output: result.output,
          exitCode: result.exitCode,
          error: result.error,
        }

        toolMessage.setContent(JSON.stringify({
          success: result.exitCode === 0 ? "Command executed successfully" : "Command failed",
          command,
          output: result.output,
          exitCode: result.exitCode,
          error: result.error,
        }))
        
        toolMessage.setChildren(render(finalCommand, true, result.exitCode === 0 ? "apply" : "reject", () => {}, () => {}, () => {}, () => {}))
        toolMessage.close()
        context.addMessage(toolMessage)

        return JSON.stringify({
          success: result.exitCode === 0 ? "Command executed successfully" : "Command failed",
          command,
          output: result.output,
          exitCode: result.exitCode,
          error: result.error,
        })
      } catch (error) {
        const errorMsg = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
        context.addMessage(errorMsg)
        throw error
      }
    }

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

      let result = { output: "", exitCode: 0, error: "" }

      if (decision === "allow") {
        const newRule = { pattern: command, permission: "allow" as PermissionLevel }
        const currentConfig = settingsStore.getState().bashPermissions || DEFAULT_BASH_PERMISSIONS
        const existingIndex = currentConfig.rules.findIndex(r => r.pattern === command)
        let newRules = [...currentConfig.rules]
        if (existingIndex >= 0) {
          newRules[existingIndex] = newRule
        } else {
          newRules.push(newRule)
        }
        const newConfig = { ...currentConfig, rules: newRules }
        settingsStore.getState().setBashPermissions(newConfig)
        await persistSettingsStore()
      }

      if (decision === "deny") {
        const newRule = { pattern: command, permission: "deny" as PermissionLevel }
        const currentConfig = settingsStore.getState().bashPermissions || DEFAULT_BASH_PERMISSIONS
        const existingIndex = currentConfig.rules.findIndex(r => r.pattern === command)
        let newRules = [...currentConfig.rules]
        if (existingIndex >= 0) {
          newRules[existingIndex] = newRule
        } else {
          newRules.push(newRule)
        }
        const newConfig = { ...currentConfig, rules: newRules }
        settingsStore.getState().setBashPermissions(newConfig)
        await persistSettingsStore()
      }

      if (decision === "apply" || decision === "allow") {
        try {
          result = await executeCommand(command, vaultPath, timeout);
        } catch (error) {
          toolMessage.setContent(JSON.stringify({
            error: "Command execution failed",
            details: error instanceof Error ? error.message : "unknown error",
          }))
        }
      } else if (decision === "deny") {
        toolMessage.setContent(JSON.stringify({
          cancelled: true,
          message: "User denied and remembered this command pattern",
        }))
      } else {
        toolMessage.setContent(JSON.stringify({
          cancelled: true,
          message: "User rejected the command",
        }))
      }

      const finalCommand: BashCommand = {
        ...bashCommand,
        output: result.output,
        exitCode: result.exitCode,
        error: result.error,
      }

      toolMessage.setChildren(render(finalCommand, true, decision, () => {}, () => {}, () => {}, () => {}))
      toolMessage.close()
      context.addMessage(toolMessage)

      return JSON.stringify({
        success: (decision === "apply" || decision === "allow") ? (result.exitCode === 0 ? "Command executed successfully" : "Command failed") : "User rejected",
        command,
        output: result.output,
        exitCode: result.exitCode,
        error: result.error,
      })
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
  onApply: () => void,
  onReject: () => void,
  onAlwaysAllow: () => void,
  onAlwaysDeny: () => void
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
