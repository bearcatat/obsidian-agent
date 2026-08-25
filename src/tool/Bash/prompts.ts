/// <reference types="node" />

function getSystemInfo(): string {
  if (process.platform === 'win32') return 'Windows Desktop';
  if (process.platform === 'darwin') return 'macOS Desktop';
  return process.platform;
}

export const DESCRIPTION = `Execute shell commands from the Vault root.

Current OS: ${getSystemInfo()}

Windows command shell:
- Windows runs PowerShell 7 when installed, otherwise Windows PowerShell.
- Use PowerShell syntax on Windows; Git Bash and cmd.exe are not fallbacks.

Write sandbox:
- The user chooses read-only, workspace-write, or complete access.
- Reads and network access are available in every mode.
- workspace-write can write the entire Vault, including .obsidian.
- Commands within the selected write boundary run by default.
- If one command needs more write access, request complete access with sandbox_permissions: "full-access" and include a short justification. There is no intermediate escalation.
- Unsupported platforms and unavailable restricted backends fail closed.

Approval:
- The conversation chooses request approval, intelligent approval, or complete-access approval.
- Declare a complete-access request explicitly. A restricted sandbox denial or the narrow Windows PowerShell HTTPS compatibility failure may request one complete-access retry.
- Some destructive, privilege-escalation, and remote-code-pipe commands are always blocked.

Notes:
- Do not use this tool to move or rename Obsidian Markdown notes. Use the note move tool instead.
- The working directory is the Vault root; it is not a read or network sandbox.`;
