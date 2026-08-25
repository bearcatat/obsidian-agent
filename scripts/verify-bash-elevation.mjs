import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const coordinator = read('src/tool/Bash/BashElevationCoordinator.ts');
const scope = read('src/tool/Bash/bash-approval-scope.ts');
const tool = read('src/tool/Bash/BashTool.tsx');
const authorization = read('src/tool/Bash/bash-authorization.ts');
const session = read('src/logic/session-logic.ts');

for (const required of [
  'class BashElevationCoordinator',
  'approvalScope.decisions',
  'approvalScope.reviewFlights',
  "toMode: 'full-access'",
  "attempt: 1",
  "'requested-capability'",
  "'sandbox-denied'",
  'isNarrowPowerShellHttpsRead',
  'isWindowsPowerShellHttpsCompatibilityFailure',
]) {
  if (!coordinator.includes(required)) throw new Error(`Elevation coordinator is missing ${required}`);
}
for (const required of ['createBashApprovalScope', 'closeBashApprovalScope', 'randomUUID', 'scope.decisions.clear()', 'scope.reviewFlights.clear()']) {
  if (!scope.includes(required)) throw new Error(`Query-local approval scope is missing ${required}`);
}
if (!tool.includes("'powershell-https-compatibility'")) throw new Error('PowerShell HTTPS elevation trigger is not routed');
for (const forbidden of ["workspace-write' | 'full-access", "requestedMode: 'workspace-write'"]) {
  if (coordinator.includes(forbidden) || tool.includes(forbidden)) throw new Error(`Intermediate elevation remains: ${forbidden}`);
}
if (!tool.includes("sandbox_permissions: z.literal('full-access')") || !tool.includes("executeAttempt('full-access'")) {
  throw new Error('Only complete-access elevation must be requestable and executable');
}
if (!authorization.includes("review.risk === 'low' || review.risk === 'medium'") || !authorization.includes("review.authorization === 'explicit'")) {
  throw new Error('Intelligent elevation auto-approval must require explicit low/medium risk');
}
if (!session.includes("sessionData.bashApprovalMode === 'intelligent' || sessionData.bashApprovalMode === 'full-access'")) {
  throw new Error('Legacy none approval mode must migrate to ask');
}

console.log('Bash elevation static checks passed');
