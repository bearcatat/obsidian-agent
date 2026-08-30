import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import esbuild from 'esbuild';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const executor = read('src/tool/Bash/execute-command.ts');
const sandbox = read('src/tool/Bash/sandbox-executor.ts');
const executionStatus = read('src/tool/Bash/bash-execution-status.ts');
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
  'curlCaBundlePath',
  "setWindowsEnvironment('CURL_CA_BUNDLE'",
  "restoreWindowsEnvironment('CURL_CA_BUNDLE'",
]) {
  if (!executor.includes(required)) throw new Error(`PowerShell executor is missing ${required}`);
}

for (const forbidden of ['getWindowsGitBashConfig', 'getWindowsCmdConfig', 'bash.exe', 'cmd.exe']) {
  if (executor.includes(forbidden)) throw new Error(`Windows shell fallback remains: ${forbidden}`);
}
if (executor.includes('SSL_CERT_FILE')) throw new Error('Windows child creation must not inject the generic SSL_CERT_FILE environment variable');

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
  'classifyCommandExecution',
]) {
  if (!sandbox.includes(required)) throw new Error(`Sandbox execution is missing ${required}`);
}
for (const required of [
  "result.error === 'Cancelled'",
  'result.startupFailed',
  'Number.isInteger(result.exitCode)',
  'result.exitCode === 0',
]) {
  if (!executionStatus.includes(required)) throw new Error(`Command outcome classification is missing ${required}`);
}
if (executionStatus.includes('!result.error.trim()')) {
  throw new Error('stderr must not turn an exit 0 command into command-failed');
}
if (sandbox.includes("new AclSandbox({ mode: 'read-only'")) {
  throw new Error('Windows logical read-only must use the DSH workspace-write token mapping');
}
if (!tool.includes('shell: result.shell') || !types.includes('version?: string') || !card.includes('agent:commandShellVersion')) {
  throw new Error('PowerShell runtime identity is not preserved in the Bash result card');
}

const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'oa-managed-curl-environment-'));
const bundlePath = path.join(fixtureDir, 'executor.cjs');
try {
  await esbuild.build({
    absWorkingDir: root, bundle: true, format: 'cjs', platform: 'node', target: 'node22', outfile: bundlePath,
    stdin: { contents: "export { spawnWithWindowsEnvironment } from './src/tool/Bash/execute-command.ts';", resolveDir: root, sourcefile: 'fixture-entry.ts' }, external: ['node:*'],
  });
  const { spawnWithWindowsEnvironment } = createRequire(import.meta.url)(bundlePath);
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  if (!platformDescriptor?.configurable) throw new Error('Cannot safely exercise Windows environment fixture on this Node runtime');
  const snapshots = [];
  const names = ['Path', 'CURL_CA_BUNDLE', 'SSL_CERT_FILE'];
  const original = Object.fromEntries(names.map((name) => [name, Object.entries(process.env).filter(([key]) => key.toLowerCase() === name.toLowerCase())]));
  const entries = (name) => Object.entries(process.env).filter(([key]) => key.toLowerCase() === name.toLowerCase());
  const replace = (name, values) => { for (const [key] of entries(name)) delete process.env[key]; for (const [key, value] of values) process.env[key] = value; };
  try {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    replace('Path', [['Path', 'C:\\System;C:\\Tools'], ['PATH', 'C:\\Legacy']]);
    replace('CURL_CA_BUNDLE', [['curl_ca_bundle', 'C:\\Old\\old-ca.crt']]);
    replace('SSL_CERT_FILE', [['SSL_CERT_FILE', 'C:\\Other\\other-ca.crt']]);
    const baseline = Object.fromEntries(names.map((name) => [name, entries(name)]));
    await Promise.all(['read-only', 'workspace-write', 'full-access'].map((mode) => spawnWithWindowsEnvironment(undefined, () => snapshots.push({ mode, path: entries('Path'), ca: entries('CURL_CA_BUNDLE'), ssl: entries('SSL_CERT_FILE') }), { pathPrefix: `C:\\Managed\\${mode}\\bin`, curlCaBundlePath: `C:\\Managed\\${mode}\\bin\\curl-ca-bundle.crt` })));
    assert.equal(snapshots.length, 3);
    for (const snapshot of snapshots) {
      assert.equal(snapshot.path.length, 1, `${snapshot.mode} must expose one case-insensitive Path key`);
      assert.ok(snapshot.path[0][1].startsWith(`C:\\Managed\\${snapshot.mode}\\bin${path.delimiter}`), `${snapshot.mode} must receive managed Path first`);
      assert.equal(snapshot.path[0][1].split(path.delimiter).filter((value) => value === `C:\\Managed\\${snapshot.mode}\\bin`).length, 1, `${snapshot.mode} must not duplicate the prefix`);
      assert.deepEqual(snapshot.ca, [['curl_ca_bundle', `C:\\Managed\\${snapshot.mode}\\bin\\curl-ca-bundle.crt`]], `${snapshot.mode} must receive its own verified curl CA bundle`);
      assert.deepEqual(snapshot.ssl, [['SSL_CERT_FILE', 'C:\\Other\\other-ca.crt']], 'SSL_CERT_FILE must never be injected or changed');
    }
    for (const name of names) assert.deepEqual(entries(name), baseline[name], `${name} must restore exact mixed-case keys and values after all child creation`);
  } finally {
    Object.defineProperty(process, 'platform', platformDescriptor);
    for (const name of names) replace(name, original[name]);
  }
} finally { await rm(fixtureDir, { recursive: true, force: true }); }

console.log('Windows PowerShell execution static checks passed');
