import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await build({ entryPoints: ['src/llm/model-provider-strategies/deepseek.ts'], bundle: true, format: 'esm', platform: 'node', write: false, tsconfig: 'tsconfig.json' });
const { default: DeepSeekProviderStrategy } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const bodies = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (_url, init) => {
  bodies.push(JSON.parse(String(init?.body ?? '{}')));
  return new Response(JSON.stringify({ id: 'test', object: 'chat.completion', created: 1, model: 'deepseek-test', choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } });
};
try {
  const strategy = new DeepSeekProviderStrategy();
  const flash = { id: 'flash', name: 'deepseek-flash', provider: 'deepseek', apiKey: 'test-only' };
  const pro = { id: 'pro', name: 'deepseek-v4-pro', provider: 'deepseek', apiKey: 'test-only' };
  await generateText({ ...strategy.buildAgentConfig(flash, 'off'), prompt: 'off' });
  await generateText({ ...strategy.buildAgentConfig(pro, 'high'), prompt: 'high' });
  await generateText({ ...strategy.buildAgentConfig(flash, 'max'), prompt: 'max' });
  const messages = strategy.normalizeMessages([{ role: 'user', content: 'use tool' }, { role: 'assistant', content: [{ type: 'reasoning', text: 'tool rationale' }, { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' }] }, { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'call-1', toolName: 'lookup', output: { type: 'text', value: 'result' } }] }], flash, 'high');
  await generateText({ ...strategy.buildAgentConfig(flash, 'high'), messages, tools: { lookup: tool({ inputSchema: z.object({}), execute: async () => 'unused' }) } });
} finally { globalThis.fetch = realFetch; }
assert.equal(bodies.length, 4);
assert.deepEqual(bodies[0].thinking, { type: 'disabled' });
assert.deepEqual(bodies[1].thinking, { type: 'enabled' }); assert.equal(bodies[1].reasoning_effort, undefined);
assert.deepEqual(bodies[2].thinking, { type: 'enabled' }); assert.equal(bodies[2].reasoning_effort, 'max');
assert.ok(JSON.stringify(bodies[3]).includes('reasoning_content'));
assert.ok(JSON.stringify(bodies[3]).includes('tool_calls') || JSON.stringify(bodies[3]).includes('tool_call_id'));
console.log('A3 captured final DeepSeek HTTP bodies:', JSON.stringify(bodies.map((body) => ({ thinking: body.thinking, reasoning_effort: body.reasoning_effort }))));
