import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const manager = read('src/tool/Bash/bash-session-temp-manager.ts');
const executor = read('src/tool/Bash/sandbox-executor.ts');
const tool = read('src/tool/Bash/BashTool.tsx');
const sessions = read('src/logic/session-logic.ts');
const main = read('src/main.ts');

for (const marker of [
  'AclWriteGrant',
  'tempWriteSid',
  'workspaceWriteSid',
  'obsidian-agent-bash-vault\\0',
  'CONVERSATION_ID',
  'activeCount',
  'retire(conversationId',
  'beginShutdown()',
  'SHUTDOWN_DRAIN_MS',
  'revokeAndRemoveOrphan',
  'removePlainTree',
]) {
  if (!manager.includes(marker)) throw new Error(`Bash session temporary manager is missing ${marker}`);
}

const windowsExecutor = executor.slice(executor.indexOf('async function executeWindowsAcl'), executor.indexOf('export async function executeSandboxedBash'));
if (manager.includes('mkdtempSync') || windowsExecutor.includes('mkdtempSync') || windowsExecutor.includes('rmSync(')) {
  throw new Error('Windows restricted Bash must not create per-command random temporary directories');
}
for (const marker of ['BashSessionTempManager', 'manageDacls: false', 'lease.tempDir', 'conversationId?: string']) {
  if (!executor.includes(marker)) throw new Error(`Windows executor is missing ${marker}`);
}
if (!tool.includes('conversationId: context.conversationId')) throw new Error('Bash tool does not forward the conversation ID');
if (!sessions.includes('BashSessionTempManager.getInstance().retire(sessionId)')) throw new Error('Session deletion does not retire Bash temporary directories');
for (const marker of ['initializeBashSessionTemp', 'BashSessionTempManager.getInstance().beginShutdown()', 'BashSessionTempManager.getInstance().shutdown()']) {
  if (!main.includes(marker)) throw new Error(`Plugin lifecycle is missing ${marker}`);
}

console.log('Bash session temporary directory checks passed');
