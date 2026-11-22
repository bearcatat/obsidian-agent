import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';

const fixtureContent = await readFile('fixtures/vault-rag-history-session.json', 'utf8');
const fixture = JSON.parse(fixtureContent);
const sessionsDir = '.obsidian/plugins/obsidian-agent/sessions';
const sessionFile = `${sessionsDir}/${fixture.id}.json`;
const bundle = await build({
  stdin: {
    contents: `
      export { SessionLogic } from './src/logic/session-logic';
      export { setGlobalApp } from './src/utils';
      export { initI18n } from './src/i18n';
    `,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: 'cjs',
  platform: 'node',
  packages: 'external',
  write: false,
});
const requireNode = createRequire(import.meta.url);
const requireHost = (name) => name === 'obsidian' ? {} : requireNode(name);
const mod = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(requireHost, mod, mod.exports);
const { SessionLogic, setGlobalApp, initI18n } = mod.exports;

await initI18n('en-US');
setGlobalApp({
  vault: { adapter: {
    exists: async (path) => path === sessionsDir || path === sessionFile,
    list: async (path) => {
      assert.equal(path, sessionsDir);
      return { files: [sessionFile], folders: [] };
    },
    read: async (path) => {
      assert.equal(path, sessionFile);
      return fixtureContent;
    },
  } },
});

const sessions = SessionLogic.getInstance();
assert.deepEqual(await sessions.listSessions(), [{
  id: fixture.id,
  title: fixture.title,
  updatedAt: fixture.updatedAt,
  hasUnread: false,
}]);
const session = await sessions.loadSession(fixture.id);
assert.ok(session);
assert.deepEqual(session.messages.map((message) => message.role), ['user', 'tool']);
const toolMessage = session.messages[1];
assert.equal(toolMessage.name, 'vaultRagSearch');
assert.equal(toolMessage.isStreaming, false);
const html = renderToStaticMarkup(toolMessage.render());
assert.match(html, /Vault RAG/);
assert.match(html, /fixture query/);
console.log('A4 listed and loaded the Vault RAG session fixture and rendered its historical result.');
