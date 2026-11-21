import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const executor = read('src/tool/Bash/execute-command.ts');
const tool = read('src/tool/Bash/BashTool.tsx');
const state = read('src/state/settings-state-impl.ts');
const persistence = read('src/logic/settings-persistence.ts');
const pkg = JSON.parse(read('package.json'));

for (const required of [
  "process.platform === 'darwin'",
  "process.platform === 'win32'",
  'getWindowsGitBashConfig',
  'getWindowsCmdConfig',
  "args: ['--noprofile', '--norc', '-lc']",
  "args: ['/u', '/c']",
]) {
  assert.ok(executor.includes(required), `host executor is missing ${required}`);
}

for (const forbidden of ['PowerShell', 'sandbox-exec', 'AclSandbox', 'koffi']) {
  assert.ok(!executor.includes(forbidden), `host executor still depends on ${forbidden}`);
}

for (const required of [
  'hostAccessAcknowledged',
  "persistSettingsStore({ bashExecution: { hostAccessAcknowledged: true } })",
  'isSettingsPersistenceReady()',
  "approvalMode === 'ask'",
  "approvalMode === 'intelligent'",
  'resolveModelApprovalAction(review)',
  'executeCommand(command, vaultPath, timeout, abortSignal)',
]) {
  assert.ok(tool.includes(required), `Bash tool is missing ${required}`);
}

for (const forbidden of ['sandbox_permissions', 'executeSandboxedBash', 'BashElevationCoordinator', 'prepareWindowsManagedCurl']) {
  assert.ok(!tool.includes(forbidden), `Bash tool still contains ${forbidden}`);
}

assert.ok(state.includes('normalizeBashExecution'), 'settings must normalize the host execution acknowledgement');
assert.ok(state.includes('hostAccessAcknowledged: false'), 'missing settings must require explicit acknowledgement');
assert.ok(state.includes("legacyMode === 'full-access'"), 'legacy complete-access users must retain their prior acknowledgement');
assert.ok(persistence.includes('bashExecution: overrides.bashExecution ?? state.bashExecution'), 'host execution acknowledgement must persist');
assert.ok(persistence.includes('function isSettingsPersistenceReady'), 'Bash must be able to require persistent acknowledgement');
assert.ok(!pkg.dependencies?.['@deepseek-ai/dsh-sandbox-windows-acl'], 'Windows ACL sandbox dependency must be removed');
assert.ok(!pkg.dependencies?.koffi, 'Koffi dependency must be removed');

console.log('Bash host execution checks passed');
