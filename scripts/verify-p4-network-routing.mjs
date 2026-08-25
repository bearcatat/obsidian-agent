import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const hardGuard = read('src/tool/Bash/bash-hard-guard.ts');
const tool = read('src/tool/Bash/BashTool.tsx');
const types = read('src/types.ts');
const card = read('src/ui/components/agent-view/messages/message/bash-tool-message-card.tsx');
const i18n = read('src/i18n/resources.ts');

for (const required of ['curl', 'wget', 'invoke-webrequest', 'iwr', 'remote-code-pipe']) {
  if (!hardGuard.toLowerCase().includes(required)) throw new Error(`Remote-code-pipe guard is missing ${required}`);
}

for (const forbidden of ["approvalMode === 'none'", "setBashApprovalMode('none')", 'approvalModeNone']) {
  if (tool.includes(forbidden) || types.includes(forbidden) || i18n.includes(forbidden)) {
    throw new Error(`Removed no-approval mode remains: ${forbidden}`);
  }
}
for (const required of ['BashElevationCoordinator', 'isWindowsPowerShellHttpsCompatibilityFailure', "executeAttempt('full-access'", 'executeSandboxedBash']) {
  if (!tool.includes(required)) throw new Error(`Bash routing is missing ${required}`);
}
if (!types.includes('"ask" | "intelligent" | "full-access"')) throw new Error('Approval modes must be ask, intelligent, and full-access');
if (!types.includes('BashElevationTrigger') || !types.includes('fingerprint: string') || !types.includes('attempt: 1')) {
  throw new Error('Elevation trace is incomplete');
}
if (!i18n.includes("approvalModeFullAccess: 'Full access'") || !i18n.includes("approvalModeFullAccess: '完全访问权限'")) {
  throw new Error('Full-access approval labels are missing');
}
if (!types.includes('| "approval-required"') || !card.includes("case 'approval-required'") || !i18n.includes("approvalRequired: 'Approval required'") || !i18n.includes("approvalRequired: '需要批准'")) {
  throw new Error('approval-required structured status is not complete');
}

console.log('P4 network routing static checks passed');
