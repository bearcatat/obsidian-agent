import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const tempDir = fs.mkdtempSync(path.join(repoRoot, 'scripts', '.tmp-i18n-'));
const outputFile = path.join(tempDir, 'i18n.cjs');

try {
  buildSync({
    absWorkingDir: repoRoot,
    entryPoints: [path.join(repoRoot, 'src', 'i18n', 'index.ts')],
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['i18next', 'react', 'react-i18next'],
  });

  const require = createRequire(import.meta.url);
  const i18n = require(outputFile);
  const { createInstance } = require('i18next');
  assert.equal(i18n.normalizeHostLocale('zh'), 'zh-CN');
  assert.equal(i18n.normalizeHostLocale('zh-CN'), 'zh-CN');
  assert.equal(i18n.normalizeHostLocale('ZH-tw'), 'zh-CN');
  assert.equal(i18n.normalizeHostLocale('zh-Hans'), 'zh-CN');
  assert.equal(i18n.normalizeHostLocale('en'), 'en-US');
  assert.equal(i18n.normalizeHostLocale('en-US'), 'en-US');
  assert.equal(i18n.normalizeHostLocale('fr-FR'), 'en-US');
  assert.equal(i18n.normalizeHostLocale(''), 'en-US');
  assert.equal(i18n.normalizeHostLocale('zh-'), 'en-US');
  assert.equal(i18n.normalizeHostLocale(undefined), 'en-US');
  assert.equal(i18n.normalizeHostLocale(123), 'en-US');
  assert.equal(i18n.resolveHostLocale({ getLanguage: () => 'zh-TW' }), 'zh-CN');
  assert.equal(i18n.resolveHostLocale({ getLanguage: () => undefined }), 'en-US');
  assert.equal(i18n.resolveHostLocale({ getLanguage: () => { throw new Error('host failure'); } }), 'en-US');
  assert.equal(i18n.resolveHostLocale({}), 'en-US');

  assert.deepEqual(
    i18n.getResourceKeys('en-US').sort(),
    i18n.getResourceKeys('zh-CN').sort(),
    'English and Chinese resource keys must stay aligned',
  );

  await i18n.initI18n('zh-CN');
  assert.equal(i18n.getUiLocale(), 'zh-CN');
  assert.equal(i18n.t('common:agentView'), 'Agent 视图');
  assert.equal(i18n.t('settings:contextWindowError'), '上下文窗口必须大于最大输出 Tokens。');
  assert.equal(i18n.t('common:missingKey'), 'missingKey');

  const fallbackInstance = createInstance();
  await fallbackInstance.init({
    resources: {
      'en-US': { common: { fallbackOnly: 'English fallback' } },
      'zh-CN': { common: {} },
    },
    lng: 'zh-CN',
    fallbackLng: 'en-US',
  });
  assert.equal(fallbackInstance.t('common:fallbackOnly'), 'English fallback');

  await i18n.initI18n('en-US');
  assert.equal(i18n.getUiLocale(), 'en-US');
  assert.equal(i18n.t('common:agentView'), 'Agent View');
  assert.equal(i18n.t('agent:sendMessageFailed', { cause: 'raw provider cause' }), 'Failed to send message: raw provider cause');

  const source = fs.readFileSync(path.join(repoRoot, 'src/i18n/resources.ts'), 'utf8');
  assert.match(source, /const commonEn/);
  assert.match(source, /const commonZh/);
  assert.match(source, /const settingsEn/);
  assert.match(source, /const settingsZh/);
  assert.match(source, /const agentEn/);
  assert.match(source, /const agentZh/);

  const date = new Date('2026-01-02T15:04:05.000Z');
  const number = 1234567.89;
  assert.notEqual(i18n.formatDateTime(date, { timeZone: 'UTC' }), '');
  assert.notEqual(i18n.formatNumber(number), '');
  assert.equal(date.toISOString(), '2026-01-02T15:04:05.000Z');
  assert.equal(number, 1234567.89);
  console.log('i18n checks passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
