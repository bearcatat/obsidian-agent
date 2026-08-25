import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import esbuild from 'esbuild';

const root = process.cwd();
const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'obsidian-agent-bash-reviewer-'));
const bundlePath = path.join(fixtureDir, 'reviewer-fixture.cjs');
const reviewerSource = readFileSync(path.join(root, 'src/tool/Bash/bash-approval-reviewer.ts'), 'utf8');

const fixtureSources = {
  ai: `
    export const Output = { object: (value) => value };
    export class ToolLoopAgent {
      constructor(settings) { globalThis.__bashReviewerSettings = settings; }
      async generate() { return globalThis.__bashReviewerGenerate(); }
    }
  `,
  manager: `
    export default class AIModelManager {
      static getInstance() {
        return {
          buildAgentConfig(model, variant) {
            globalThis.__bashReviewerModelConfig = { model, variant };
            return { model: { provider: 'fixture', modelId: 'fixture' } };
          },
        };
      }
    }
  `,
  types: `export const ModelProviders = { DEEPSEEK: 'deepseek' };`,
  zod: `
    const fail = (message) => { const error = new Error(message); error.name = 'ZodError'; throw error; };
    export const z = {
      enum(values) { return { kind: 'enum', values }; },
      string() {
        return {
          kind: 'string', minLength: 0, maxLength: Infinity,
          min(value) { this.minLength = value; return this; },
          max(value) { this.maxLength = value; return this; },
        };
      },
      object(shape) {
        return {
          strict() { return this; },
          parse(value) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) fail('review must be an object');
            for (const key of Object.keys(value)) if (!(key in shape)) fail('unexpected review key');
            for (const [key, schema] of Object.entries(shape)) {
              const candidate = value[key];
              if (schema.kind === 'enum' && !schema.values.includes(candidate)) fail(key + ' is invalid');
              if (schema.kind === 'string' && (typeof candidate !== 'string' || candidate.length < schema.minLength || candidate.length > schema.maxLength)) {
                fail(key + ' too_big max ' + schema.maxLength);
              }
            }
            return value;
          },
        };
      },
    };
  `,
  evidence: `
    export function inferBashApprovalEvidence() { return {}; }
    export function sanitizeBashApprovalText(value) { return value; }
  `,
};

await esbuild.build({
  absWorkingDir: root,
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  outfile: bundlePath,
  entryPoints: ['fixture-reviewer'],
  plugins: [{
    name: 'bash-reviewer-fixtures',
    setup(build) {
      build.onResolve({ filter: /^fixture-reviewer$/ }, () => ({ path: 'reviewer', namespace: 'fixture' }));
      build.onResolve({ filter: /^ai$/ }, () => ({ path: 'ai', namespace: 'fixture' }));
      build.onResolve({ filter: /^zod$/ }, () => ({ path: 'zod', namespace: 'fixture' }));
      build.onResolve({ filter: /^@\/llm\/ModelManager$/ }, () => ({ path: 'manager', namespace: 'fixture' }));
      build.onResolve({ filter: /^@\/types$/ }, () => ({ path: 'types', namespace: 'fixture' }));
      build.onResolve({ filter: /^\.\/approval-evidence-provider$/ }, () => ({ path: 'evidence', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
        contents: args.path === 'reviewer' ? reviewerSource : fixtureSources[args.path],
        loader: args.path === 'reviewer' ? 'ts' : 'js',
        resolveDir: root,
      }));
    },
  }],
});

try {
  const reviewer = createRequire(import.meta.url)(bundlePath);
  const longReason = 'r'.repeat(302);
  const reviewJson = JSON.stringify({
    decision: 'allow',
    risk: 'low',
    authorization: 'explicit',
    reason: longReason,
  });

  const transportReview = reviewer.parseTextBashApprovalReview(reviewJson);
  assert.equal(transportReview.reason.length, 302, 'a valid transport reason over 240 characters must be accepted');
  assert.throws(
    () => reviewer.parseTextBashApprovalReview(reviewJson.replace(longReason, 'r'.repeat(1025))),
    /too_big|1024/i,
    'transport reason must remain bounded',
  );

  const reviewerContext = {
    model: { provider: 'deepseek', name: 'deepseek-v4-flash' },
    variant: 'max',
    bashApprovalContext: {
      conversationId: 'fixture-conversation',
      currentTurnId: 'fixture-turn',
      currentUser: { role: 'user', text: 'Write the disposable marker.' },
      priorUserMessages: [],
      recentAssistantUpdates: [],
      currentTurnActions: [],
      activeConstraints: [],
      cwdScope: 'vault-root',
      authorizationContextTruncated: false,
    },
  };
  globalThis.__bashReviewerGenerate = async () => ({ text: Promise.resolve(reviewJson) });
  const result = await reviewer.reviewBashCommand('Set-Content -LiteralPath C:\\fixture.txt -Value marker', reviewerContext);
  assert.equal(result.reason.length, 240, 'stored and displayed reason must be capped independently from transport validation');
  assert.equal(globalThis.__bashReviewerModelConfig.variant, 'off', 'reviewer must not inherit the chat reasoning variant');

  const originalWarn = console.warn;
  const diagnostics = [];
  console.warn = (...args) => diagnostics.push(args);
  try {
    globalThis.__bashReviewerGenerate = async () => ({ text: Promise.resolve(reviewJson.replace(longReason, 'r'.repeat(1025))) });
    await assert.rejects(
      () => reviewer.reviewBashCommand('Set-Content -LiteralPath C:\\fixture.txt -Value marker', reviewerContext),
      /too_big|1024/i,
    );
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(
    diagnostics[0],
    ['[BashApprovalReviewer] review validation failed', { code: 'text-json-invalid', provider: 'deepseek' }],
    'invalid transport output must keep the safe reviewer diagnostic',
  );

  console.log('Bash approval reviewer runtime fixtures passed');
} finally {
  await rm(fixtureDir, { recursive: true, force: true });
}
