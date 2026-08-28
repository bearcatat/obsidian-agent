import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const sandbox = read('src/tool/Bash/sandbox-executor.ts');
const sessionTemp = read('src/tool/Bash/bash-session-temp-manager.ts');
const tool = read('src/tool/Bash/BashTool.tsx');
const settings = read('src/tool/BuiltinTools.ts');

for (const required of ['AclSandbox', 'BashSessionTempManager', 'manageDacls: false', 'sandbox-unavailable']) {
  if (!sandbox.includes(required)) throw new Error(`Windows sandbox integration is missing ${required}`);
}
for (const required of ['AclWriteGrant', 'workspaceWriteSid', 'tempWriteSid', 'prepareEmbeddedKoffi']) {
  if (!sessionTemp.includes(required)) throw new Error(`Windows session temporary integration is missing ${required}`);
}
if (sandbox.includes("'.obsidian'")) throw new Error('Sandbox executor must not add a .obsidian write deny');
if (!tool.includes('sandbox_permissions') || !tool.includes('justification')) throw new Error('Bash escalation schema is missing');
for (const removed of ['BashPermissionConfig', 'resolveRulePermission', 'globMatches']) {
  if (settings.includes(removed) || tool.includes(removed)) throw new Error(`Legacy Bash approval code remains: ${removed}`);
}

const main = path.join(root, 'main.js');
if (existsSync(main)) {
  const bundle = readFileSync(main, 'utf8');
  for (const marker of ['2470bca8e26730762ca4b21ba15f233a45bf7f57bf2340826b9435843ea8cc14', '74f6b141bb28d59acbc067878afc7bb266d0bf2d3f4d9b20107188243bce9979']) {
    if (!bundle.includes(marker)) throw new Error(`Production bundle does not include Koffi payload manifest ${marker}`);
  }
}

console.log('Bash sandbox static security checks passed');
