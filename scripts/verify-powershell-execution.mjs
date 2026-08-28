import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const executor = read('src/tool/Bash/execute-command.ts');
const sandbox = read('src/tool/Bash/sandbox-executor.ts');
const tool = read('src/tool/Bash/BashTool.tsx');
const card = read('src/ui/components/agent-view/messages/message/bash-tool-message-card.tsx');
const types = read('src/types.ts');

for (const required of [
  'getWindowsPowerShellConfig',
  'PowerShell 7',
  'Windows PowerShell',
  "'-NoLogo', '-NoProfile', '-NonInteractive', '-Command'",
  'getWindowsPowerShellInfo',
  'startupFailed',
  'spawnWithWindowsEnvironment',
  'windowsSpawnMutex',
  'process.env.TMP = tempDir',
  'process.env.TEMP = tempDir',
  'else delete process.env.TMP',
  'else delete process.env.TEMP',
]) {
  if (!executor.includes(required)) throw new Error(`PowerShell executor is missing ${required}`);
}

for (const forbidden of ['getWindowsGitBashConfig', 'getWindowsCmdConfig', 'bash.exe', 'cmd.exe']) {
  if (executor.includes(forbidden)) throw new Error(`Windows shell fallback remains: ${forbidden}`);
}

for (const forbidden of ['PSVersionTable', 'OutputEncoding', '[Console]', 'Text.UTF8', 'formatWindowsPowerShellCommand', 'extractWindowsPowerShellResult']) {
  if (executor.includes(forbidden)) throw new Error(`Constrained Language Mode unsafe PowerShell wrapper remains: ${forbidden}`);
}

for (const required of [
  'getWindowsPowerShellConfig',
  'getWindowsPowerShellInfo',
  "mode === 'full-access'",
  'executeCommand',
  'spawnWithWindowsEnvironment(lease.tempDir',
  'writableDirs: []',
  "mode: 'workspace-write'",
  'lease.writeSid',
  'lease.tempWriteSid',
  'manageDacls: false',
  '!result.error.trim()',
  'Number.isInteger(result.exitCode)',
]) {
  if (!sandbox.includes(required)) throw new Error(`Sandbox execution is missing ${required}`);
}
if (sandbox.includes("new AclSandbox({ mode: 'read-only'")) {
  throw new Error('Windows logical read-only must use the DSH workspace-write token mapping');
}
if (!tool.includes('shell: result.shell') || !types.includes('version?: string') || !card.includes('agent:commandShellVersion')) {
  throw new Error('PowerShell runtime identity is not preserved in the Bash result card');
}

console.log('Windows PowerShell execution static checks passed');
