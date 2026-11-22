import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(input) {
  const options = typeof input === 'string' ? { entryPoints: [input] } : input;
  const result = await build({ bundle: true, format: 'esm', platform: 'node', write: false, tsconfig: 'tsconfig.json', ...options });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const utils = await load('src/llm/official-model-utils.ts');
const selectable = await load('src/llm/selectable-model-utils.ts');
const selection = await load('src/llm/official-model-selection.ts');
const transaction = await load('src/logic/model-persistence-transaction.ts');

const override = utils.validateOfficialPresetList([{ id: 'deepseek-flash', displayName: 'Flash override' }, { id: 'deepseek-extra', displayName: 'Extra' }]);
assert.deepEqual(utils.mergeOfficialPresets(utils.DEFAULT_DEEPSEEK_PRESETS, override).map((item) => item.id), ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-extra']);
assert.equal(utils.mergeOfficialPresets(utils.DEFAULT_DEEPSEEK_PRESETS, override)[0].displayName, 'Flash override');
assert.throws(() => utils.validateOfficialPresetList([{ id: 'same', displayName: 'A' }, { id: 'same', displayName: 'B' }]));

const official = { id: 'official:deepseek:deepseek-flash', name: 'deepseek-flash', provider: 'deepseek', source: 'official' };
const user = { id: 'DeepSeek Flash', name: 'deepseek-flash', provider: 'deepseek', source: 'user' };
assert.deepEqual(selectable.selectableModels([official], [user]).map((item) => item.id), [official.id, user.id]);
assert.equal(selection.clearHiddenOfficialDeepSeekModel(official), null);
assert.equal(selection.clearHiddenOfficialDeepSeekModel(user), user);
assert.deepEqual(selection.clearOfficialDeepSeekSelections({ current: official, defaultModel: official, title: user, image: null }), { current: null, defaultModel: null, title: user, image: null });

let value = ''; const storage = { setSecret: (id, next) => { assert.equal(id, 'custom-key'); value = next; }, getSecret: () => value };
const credentials = await load('src/llm/credentials.ts');
credentials.writeSecretAndConfirm(storage, 'custom-key', 'secret-for-test-only');
assert.equal(value, 'secret-for-test-only');
assert.throws(() => credentials.writeSecretAndConfirm({ setSecret: () => { throw new Error('write failed'); }, getSecret: () => '' }, 'custom-key', 'x'));
assert.throws(() => credentials.writeSecretAndConfirm({ setSecret: () => {}, getSecret: () => 'different-value' }, 'custom-key', 'x'));
assert.throws(() => credentials.writeSecretAndConfirm(storage, 'Invalid key', 'x'));
credentials.writeSecretAndConfirm(storage, 'custom-key', '', true);
assert.equal(value, '');

let current = ['old'];
await transaction.persistModelTransaction(() => { current = ['new']; }, () => { current = ['old']; }, async () => undefined);
assert.deepEqual(current, ['new']);
await assert.rejects(() => transaction.persistModelTransaction(() => { current = ['bad']; }, () => { current = ['old']; }, async () => { throw new Error('save failed'); }));
assert.deepEqual(current, ['old']);

const logic = await (await import('node:fs/promises')).readFile('src/logic/settings-logic.tsx', 'utf8');
assert.match(logic, /private saveQueue/); assert.match(logic, /previousModels/); assert.match(logic, /credentialRef/);
const { OfficialModelCatalog, DEEPSEEK_OVERRIDE_PATH, initI18n, notices } = await load({
  stdin: {
    contents: "export * from './src/llm/OfficialModelCatalog'; export { initI18n } from './src/i18n'; export { notices } from 'obsidian';",
    resolveDir: process.cwd(),
  },
  plugins: [{
    name: 'mock-obsidian-notice',
    setup(build) {
      build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'mock' }));
      build.onLoad({ filter: /^obsidian$/, namespace: 'mock' }, () => ({
        contents: 'export const notices = []; export class Notice { constructor(message) { notices.push(message); } }',
      }));
    },
  }],
});

await initI18n('zh-CN');
const validOverride = JSON.stringify({ provider: 'deepseek', models: override });
let overrideContent = validOverride;
const catalog = new OfficialModelCatalog({
  secretStorage: { getSecret: () => 'test-key' },
  vault: { adapter: {
    exists: async () => overrideContent !== null,
    read: async () => overrideContent,
  } },
});

const warn = console.warn;
try {
  console.warn = () => {};
  await catalog.refresh();
  const lastUsable = catalog.getCache();
  assert.equal(lastUsable.version, 1);
  assert.equal(catalog.getModels()[0].displayName, 'Flash override');

  overrideContent = '{';
  await catalog.refresh();
  await catalog.refresh();
  assert.deepEqual(catalog.getCache(), lastUsable);
  assert.equal(notices.length, 1);
  assert.ok(notices[0].includes(DEEPSEEK_OVERRIDE_PATH));
  assert.ok(notices[0].includes('覆盖文件无效'));

  overrideContent = validOverride;
  await catalog.refresh();
  assert.equal(notices.length, 1);
  overrideContent = '{';
  await catalog.refresh();
  assert.equal(notices.length, 2);

  overrideContent = null;
  await catalog.refresh();
  assert.deepEqual(catalog.getCache().models, utils.DEFAULT_DEEPSEEK_PRESETS);
  overrideContent = '{';
  await catalog.refresh();
  assert.equal(notices.length, 3);
} finally {
  console.warn = warn;
}

console.log('A2 official catalog, SecretStorage, migration transaction, selection, and save queue checks passed.');
