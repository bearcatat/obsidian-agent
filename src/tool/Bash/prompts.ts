/// <reference types="node" />

function getSystemInfo(): string {
  if (process.platform === 'win32') return 'Windows Desktop';
  if (process.platform === 'darwin') return 'macOS Desktop';
  return process.platform;
}

export const DESCRIPTION = `Execute shell commands from the Vault root.

Current OS: ${getSystemInfo()}

Windows command shell:
- Windows uses Git Bash when installed. If it is unavailable, Windows Command Prompt runs the command.
- Use Bash syntax when Git Bash is available. If the command fails because Command Prompt is used, adapt it to cmd.exe syntax.

macOS command shell:
- macOS uses /bin/bash and Bash syntax.

Local execution:
- Commands run with the same operating-system permissions as Obsidian Agent. The Vault root is the working directory only.
- Do not claim that a command is restricted to the Vault. Ask for user approval whenever the selected approval mode requires it.

Approval:
- The conversation chooses request approval, intelligent approval, or automatic approval.
- Some destructive, privilege-escalation, and remote-code-pipe commands are always blocked.

Notes:
- Do not use this tool to move or rename Obsidian Markdown notes. Use the note move tool instead.
- The working directory is the Vault root; it is not a sandbox.`;
