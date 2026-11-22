import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const files = [
  'src/main.ts',
  'src/logic/settings-logic.tsx',
  'src/state/settings-state.ts',
  'src/state/settings-state-impl.ts',
  'src/tool/BuiltinTools.ts',
  'src/tool/registry/BuiltinToolRegistry.ts',
].map(async (file) => [file, await readFile(file, 'utf8')]);
const source = Object.fromEntries(await Promise.all(files));
for (const [file, text] of Object.entries(source)) {
  assert.doesNotMatch(text, /VaultRagService|vaultRagSearch|embeddingModels|ragSettings/, `${file} still exposes a Vault RAG execution entry`);
}
await assert.rejects(access('src/retrieval/VaultRagService.ts'));
await assert.rejects(access('src/tool/VaultRag/VaultRagSearchTool.tsx'));
const renderer = await readFile('src/ui/components/agent-view/messages/message/historical-tool-renderer.tsx', 'utf8');
assert.match(renderer, /case 'vaultRagSearch'/);
assert.match(renderer, /renderVaultRagHistoryMessage/);
const fixture = JSON.parse(await readFile('fixtures/vault-rag-history-session.json', 'utf8'));
const restoredMessages = fixture.turns.flatMap((turn) => turn.assistantMessages);
const payload = JSON.parse(restoredMessages.find((message) => message.name === 'vaultRagSearch').content);
assert.equal(payload.response.hits[0].path, 'Fixture Note.md');
assert.match(source['src/tool/BuiltinTools.ts'], /name: "search"/);
console.log('A4 removed Vault RAG runtime/settings/tool entries, retained search and the historical fixture path.');
