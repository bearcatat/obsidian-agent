/// <reference types="node" />
function getSystemInfo(): string {
  const platform = process.platform;
  switch (platform) {
    case 'win32': return 'Windows (win32)';
    case 'darwin': return 'macOS (darwin)';
    case 'linux': return 'Linux (linux)';
    default: return platform;
  }
}

function getShellInfo(): string {
  const isWindows = process.platform === 'win32';
  
  if (!isWindows) {
    return 'Shell: /bin/bash';
  }
  
  const shellEnv = process.env.SHELL;
  if (shellEnv && shellEnv.includes('bash')) {
    return `Shell: ${shellEnv}`;
  }
  
  return 'Shell: cmd.exe';
}

export const DESCRIPTION = `Execute shell commands in the vault directory.

Current OS: ${getSystemInfo()}
${getShellInfo()}

Usage:
- Provide the command to execute
- The command will run in the vault's root directory
- Use appropriate commands for your platform
- Some dangerous commands are blocked by default

Default policy:
- Most commands require user confirmation (ask)
- Safe commands like 'git status', 'npm *' may be auto-allowed

Blocked commands (cannot be overridden):
- Commands that attempt to escape the vault directory
- Commands that could harm the system

Note: This tool only works within the Obsidian vault.`;
