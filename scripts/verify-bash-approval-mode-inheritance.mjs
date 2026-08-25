import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(path.join(process.cwd(), 'src/state/agent-state-impl.ts'), 'utf8');
const input = readFileSync(path.join(process.cwd(), 'src/ui/components/agent-view/input/buttom.tsx'), 'utf8');
const dropdown = readFileSync(path.join(process.cwd(), 'src/ui/components/agent-view/input/bash-approval-mode-dropdown.tsx'), 'utf8');
const logic = readFileSync(path.join(process.cwd(), 'src/logic/agent-view-logic.tsx'), 'utf8');
const selection = readFileSync(path.join(process.cwd(), 'src/logic/bash-approval-mode-logic.ts'), 'utf8');
const session = readFileSync(path.join(process.cwd(), 'src/logic/session-logic.ts'), 'utf8');
const resources = readFileSync(path.join(process.cwd(), 'src/i18n/resources.ts'), 'utf8');

for (const required of [
  'function inheritedBashApprovalMode',
  "value === 'ask' || value === 'intelligent' || value === 'full-access'",
  'state.bashApprovalMode = source.bashApprovalMode',
  'state.bashApprovalMode = mode',
  'state.activeConversationId,\n            state.bashApprovalMode,',
  'return recent && isBashApprovalMode(recent.bashApprovalMode) ? recent.bashApprovalMode : fallback',
  'conversation.updatedAt = Date.now()',
]) {
  if (!source.includes(required)) throw new Error(`Bash approval mode inheritance is missing ${required}`);
}

for (const required of [
  '<BashApprovalModeDropdown',
  'mode={bashApprovalMode}',
  'open={isApprovalDropdownOpen}',
  'onOpenChange={setIsApprovalDropdownOpen}',
  'onSelectMode={selectBashApprovalMode}',
  "new Notice(t('agent:approvalModeSaveFailed'))",
]) {
  if (!input.includes(required)) throw new Error(`Approval dropdown does not commit ${required}`);
}

for (const required of [
  'DropdownMenuTrigger asChild',
  '<Button variant="ghost2" size="fit">',
  '<DropdownMenuContent align="start">',
  '<DropdownMenuItem key={option} onSelect={() => onSelectMode(option)}>',
]) {
  if (!dropdown.includes(required)) throw new Error(`Approval dropdown diverges from the model selector baseline: ${required}`);
}
if (dropdown.includes('Radio') || dropdown.includes('onClick=')) {
  throw new Error('Approval dropdown must not use radio visuals or click/value-change event duplication');
}

if (!logic.includes('return setActiveConversationBashApprovalMode(mode).catch((error) =>')
  || logic.includes('setBashApprovalMode(previous')
  || !logic.includes('throw error')) {
  throw new Error('Explicit approval mode must remain applied when persistence fails');
}

if (!selection.includes('state.setBashApprovalMode(mode, conversationId ?? undefined)')
  || !selection.includes('if (!conversationId) return Promise.resolve()')
  || !selection.includes('saveSessionNow(updated, true)')) {
  throw new Error('Approval selection must commit the active store conversation and persist that snapshot');
}

if (!session.includes('saveSessionInternal(state.sessionId, state, true)')
  || !session.includes('if (throwOnError) throw e')) {
  throw new Error('Immediate session persistence must report write failures to the selection handler');
}

if (!resources.includes("approvalModeSaveFailed: 'The approval mode was applied for this session but could not be saved.'")
  || !resources.includes("approvalModeSaveFailed: '审批模式已应用到当前会话，但暂时无法保存。'")) {
  throw new Error('Approval mode persistence feedback is missing i18n text');
}

console.log('Bash approval mode inheritance checks passed');
