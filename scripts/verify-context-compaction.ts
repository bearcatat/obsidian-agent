import assert from 'node:assert/strict';
import { ModelMessage } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { ContextCheckpoint } from '../src/types';
import {
  applyUsageCalibration,
  assembleActiveContext,
  calculateContextBudget,
  classifyContextOverflow,
  ContextCompactionError,
  createContextCheckpoint,
  estimateTextTokens,
  getCumulativeMessageDelta,
  normalizeGeneratedSummary,
  partitionModelHistoryByTurn,
  serializeContextForModel,
  updateUsageCalibration,
  updateContextRuntimeForModelChange,
  validateContextCheckpoint,
  validateContextUsageCalibration,
  withContextCompactionLock,
} from '../src/llm/ContextCompaction';

const VALID_SUMMARY = '## 当前目标\nA\n## 用户明确要求与限制\nB\n## 已完成工作与证据\nC\n## 正在进行的工作\nD\n## 重要决定及原因\nE\n## 错误、阻塞与待核实事项\nF\n## 下一步\nG\n## 相关文件与标识符\nH';

function checkpoint(anchor: string): ContextCheckpoint {
  return {
    version: 1,
    summary: VALID_SUMMARY,
    coveredThroughTurnId: anchor,
    createdAt: 1,
    sourceModelId: 'model',
    sourceProvider: 'provider',
    reason: 'manual',
  };
}

async function main(): Promise<void> {
  const messages: ModelMessage[] = [
    { role: 'user', content: 'first' },
    {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'old reasoning' },
        { type: 'tool-call', toolCallId: 'call-1', toolName: 'search', input: { q: 'x' } },
      ],
    },
    {
      role: 'tool',
      content: [{
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'search',
        output: { type: 'text', value: 'z'.repeat(5_000) },
      }],
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'second' },
        { type: 'image', image: `data:image/png;base64,${'a'.repeat(4_000)}` },
      ],
    },
    { role: 'assistant', content: [{ type: 'reasoning', text: 'latest reasoning' }] },
  ];

  const partitioned = partitionModelHistoryByTurn(messages, ['turn-1', 'turn-2']);
  assert.equal(partitioned.turns.length, 2);
  assert.equal(partitioned.turns[0].messages.length, 3);
  assert.equal(partitioned.turns[0].messages[2].role, 'tool');

  const durableBefore = JSON.stringify(messages);
  const active = assembleActiveContext({
    rawMessages: messages,
    turnIds: ['turn-1', 'turn-2'],
    checkpoint: checkpoint('turn-1'),
  });
  assert.equal(JSON.stringify(messages), durableBefore, 'active assembly must not mutate durable messages');
  assert.equal(active.checkpointApplied, true);
  assert.equal(active.retainedTurnCount, 1);
  assert.equal(active.messages.some(message => JSON.stringify(message).includes('first')), false);
  assert.equal(active.messages.some(message => JSON.stringify(message).includes('Historical checkpoint')), true);

  const pruned = serializeContextForModel(messages);
  assert.equal(JSON.stringify(messages), durableBefore, 'request pruning must not mutate durable messages');
  assert.equal(JSON.stringify(pruned).includes('old reasoning'), false);
  assert.equal(JSON.stringify(pruned).includes('latest reasoning'), true);
  const compactToolMessage = pruned.find(message => message.role === 'tool');
  assert.ok(compactToolMessage);
  assert.ok(JSON.stringify(compactToolMessage).length < 2_500);

  const currentTurnWithLargeToolOutput: ModelMessage[] = [
    { role: 'user', content: 'current turn' },
    {
      role: 'assistant',
      content: [{ type: 'tool-call', toolCallId: 'current-call', toolName: 'read', input: { path: 'file.md' } }],
    },
    {
      role: 'tool',
      content: [{
        type: 'tool-result',
        toolCallId: 'current-call',
        toolName: 'read',
        output: { type: 'text', value: 'current-output'.repeat(1_000) },
      }],
    },
  ];
  const currentTurnPruned = serializeContextForModel(currentTurnWithLargeToolOutput);
  assert.ok(JSON.stringify(currentTurnPruned).length < 3_000, 'completed current-turn tool output must be request-pruned');
  assert.equal(JSON.stringify(currentTurnWithLargeToolOutput).includes('current-output'.repeat(1_000)), true);

  assert.ok(estimateTextTokens('汉'.repeat(100)) >= 100);
  assert.ok(estimateTextTokens('a'.repeat(100)) <= 25);
  assert.ok(estimateTextTokens(`data:image/png;base64,${'a'.repeat(3_000)}`) >= 1_000);

  const key = { modelConfigId: 'config', provider: 'provider', modelId: 'model', variant: null } as const;
  const firstCalibration = updateUsageCalibration({
    key,
    heuristicTokens: 100,
    inputTokens: 200,
    now: 1,
  });
  assert.ok(firstCalibration);
  assert.equal(firstCalibration.factor, 2);
  const secondCalibration = updateUsageCalibration({
    current: firstCalibration,
    key,
    heuristicTokens: 100,
    inputTokens: 100,
    now: 2,
  });
  assert.ok(secondCalibration);
  assert.equal(secondCalibration.factor, 1.7);
  assert.equal(applyUsageCalibration(100, secondCalibration, key), 170);
  assert.equal(applyUsageCalibration(100, secondCalibration, { ...key, modelId: 'other' }), 100);
  assert.ok(validateContextUsageCalibration(secondCalibration));

  assert.ok(validateContextCheckpoint(checkpoint('turn-1'), ['turn-1', 'turn-2']));
  assert.equal(validateContextCheckpoint(checkpoint('missing'), ['turn-1', 'turn-2']), undefined);
  assert.equal(validateContextCheckpoint({ ...checkpoint('turn-1'), version: 2 }, ['turn-1']), undefined);

  assert.equal(classifyContextOverflow(new Error('maximum context length exceeded')), true);
  assert.equal(classifyContextOverflow({ statusCode: 400, message: 'invalid request' }), false);
  assert.equal(classifyContextOverflow({ cause: { code: 'context_length_exceeded' } }), true);

  assert.deepEqual(calculateContextBudget(128_000, 8_192), {
    contextWindow: 128_000,
    outputReserve: 8_192,
    safetyBuffer: 12_800,
    maxEstimatedInputTokens: 115_200,
  });
  assert.equal(calculateContextBudget(8_000, 8_000), undefined);

  const normalizedSummary = normalizeGeneratedSummary(VALID_SUMMARY
    .replace('## 当前目标', '# **当前目标**：')
    .replace('## 下一步', '7. `下一步`'));
  assert.ok(normalizedSummary);
  assert.ok(normalizedSummary.includes('## 当前目标'));
  assert.ok(normalizedSummary.includes('## 下一步'));
  assert.equal(normalizeGeneratedSummary('## 当前目标\n只有一个章节'), undefined);

  const retryableErrorAfterModelChange = updateContextRuntimeForModelChange({
    status: 'error',
    lastError: 'summary failed',
    retryable: true,
    heuristicInputTokens: 9_000,
    estimatedInputTokens: 10_000,
    contextWindow: 16_000,
    message: '压缩失败',
  }, 128_000);
  assert.equal(retryableErrorAfterModelChange.status, 'error');
  assert.equal(retryableErrorAfterModelChange.lastError, 'summary failed');
  assert.equal(retryableErrorAfterModelChange.retryable, true);
  assert.equal(retryableErrorAfterModelChange.contextWindow, 128_000);
  assert.equal(retryableErrorAfterModelChange.estimatedInputTokens, undefined);

  const idleAfterModelChange = updateContextRuntimeForModelChange({
    status: 'error',
    lastError: 'not retryable',
    retryable: false,
    contextWindow: 16_000,
  }, 32_000);
  assert.equal(idleAfterModelChange.status, 'idle');
  assert.equal(idleAfterModelChange.lastError, undefined);

  const firstStepMessages: ModelMessage[] = [
    { role: 'assistant', content: 'step-1' },
    { role: 'tool', content: [] },
  ];
  const firstStepDelta = getCumulativeMessageDelta(firstStepMessages, 0);
  assert.equal(firstStepDelta.messages.length, 2);
  const secondStepDelta = getCumulativeMessageDelta([
    ...firstStepMessages,
    { role: 'assistant', content: 'step-2' },
  ], firstStepDelta.nextCount);
  assert.deepEqual(secondStepDelta.messages, [{ role: 'assistant', content: 'step-2' }]);

  const sameConversationOrder: string[] = [];
  let sameConversationActive = 0;
  let sameConversationMaxActive = 0;
  const sameConversationGates = Array.from({ length: 3 }, () => {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
  });
  const sameConversationStarted = Array.from({ length: 3 }, () => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
  });
  const sameConversationTasks = sameConversationGates.map((gate, index) => (
    withContextCompactionLock('same', async () => {
      sameConversationActive += 1;
      sameConversationMaxActive = Math.max(sameConversationMaxActive, sameConversationActive);
      sameConversationOrder.push(`${index + 1}-start`);
      sameConversationStarted[index].resolve();
      await gate.promise;
      sameConversationOrder.push(`${index + 1}-end`);
      sameConversationActive -= 1;
    })
  ));

  await sameConversationStarted[0].promise;
  assert.deepEqual(sameConversationOrder, ['1-start']);
  sameConversationGates[0].release();
  await sameConversationStarted[1].promise;
  assert.deepEqual(sameConversationOrder, ['1-start', '1-end', '2-start']);
  sameConversationGates[1].release();
  await sameConversationStarted[2].promise;
  assert.deepEqual(sameConversationOrder, ['1-start', '1-end', '2-start', '2-end', '3-start']);
  sameConversationGates[2].release();
  await Promise.all(sameConversationTasks);
  assert.equal(sameConversationMaxActive, 1, 'three compactions for one conversation must run serially');

  let differentConversationActive = 0;
  let differentConversationMaxActive = 0;
  const runDifferentConversationTask = (conversationId: string) => (
    withContextCompactionLock(conversationId, async () => {
      differentConversationActive += 1;
      differentConversationMaxActive = Math.max(differentConversationMaxActive, differentConversationActive);
      await Promise.resolve();
      differentConversationActive -= 1;
    })
  );
  await Promise.all([
    runDifferentConversationTask('parallel-a'),
    runDifferentConversationTask('parallel-b'),
  ]);
  assert.equal(differentConversationMaxActive, 2, 'different conversations must remain parallel');

  const checkpointHistory: ModelMessage[] = Array.from({ length: 6 }, (_, index) => ([
    { role: 'user' as const, content: `user-${index + 1}` },
    { role: 'assistant' as const, content: `assistant-${index + 1}` },
  ])).flat();
  const checkpointHistoryBefore = JSON.stringify(checkpointHistory);
  const mockModel = new MockLanguageModelV3({
    provider: 'mock-provider',
    modelId: 'mock-model',
    doGenerate: {
      content: [{ type: 'text', text: VALID_SUMMARY }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 200, noCache: 200, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 100, text: 100, reasoning: 0 },
      },
      warnings: [],
    },
  });
  const created = await createContextCheckpoint({
    agentConfig: { model: mockModel },
    rawMessages: checkpointHistory,
    turnIds: ['turn-1', 'turn-2', 'turn-3', 'turn-4', 'turn-5', 'turn-6'],
    reason: 'manual',
    focus: '保留关键路径',
    abortSignal: new AbortController().signal,
  });
  assert.equal(mockModel.doGenerateCalls.length, 1);
  assert.equal(mockModel.doGenerateCalls[0].maxOutputTokens, 2_048);
  assert.equal(created.checkpoint.coveredThroughTurnId, 'turn-2');
  assert.equal(created.retainedTurnCount, 4);
  assert.equal(created.checkpoint.sourceProvider, 'mock-provider');
  assert.equal(created.checkpoint.sourceModelId, 'mock-model');
  assert.equal(created.checkpoint.focus, '保留关键路径');
  assert.equal(JSON.stringify(checkpointHistory), checkpointHistoryBefore, 'checkpoint creation must not mutate durable messages');
  assert.ok(JSON.stringify(mockModel.doGenerateCalls[0].prompt).includes('保留关键路径'));

  const largeCheckpointHistory: ModelMessage[] = Array.from({ length: 6 }, (_, index) => ([
    { role: 'user' as const, content: `large-user-${index + 1}:${'汉'.repeat(800)}` },
    { role: 'assistant' as const, content: `large-assistant-${index + 1}:${'汉'.repeat(800)}` },
  ])).flat();
  const partial = await createContextCheckpoint({
    agentConfig: { model: mockModel },
    rawMessages: largeCheckpointHistory,
    turnIds: ['large-1', 'large-2', 'large-3', 'large-4', 'large-5', 'large-6'],
    reason: 'preflight',
    contextWindow: 6_000,
    abortSignal: new AbortController().signal,
  });
  assert.equal(partial.checkpoint.coveredThroughTurnId, 'large-1');
  assert.equal(partial.retainedTurnCount, 5);
  assert.equal(mockModel.doGenerateCalls[1].maxOutputTokens, 2_048);
  const partialPrompt = JSON.stringify(mockModel.doGenerateCalls[1].prompt);
  assert.ok(partialPrompt.includes('large-user-1'));
  assert.equal(partialPrompt.includes('large-user-2'), false, 'checkpoint anchor must not advance past omitted turns');

  const shortKnownHistory: ModelMessage[] = Array.from({ length: 3 }, (_, index) => ([
    { role: 'user' as const, content: `short-user-${index + 1}` },
    { role: 'assistant' as const, content: `short-assistant-${index + 1}` },
  ])).flat();
  const shortKnown = await createContextCheckpoint({
    agentConfig: { model: mockModel },
    rawMessages: shortKnownHistory,
    turnIds: ['short-1', 'short-2', 'short-3'],
    reason: 'preflight',
    contextWindow: 128_000,
    abortSignal: new AbortController().signal,
  });
  assert.equal(shortKnown.checkpoint.coveredThroughTurnId, 'short-1');
  assert.equal(shortKnown.retainedTurnCount, 2);
  assert.equal(mockModel.doGenerateCalls[2].maxOutputTokens, 4_096);

  const previousCheckpoint = checkpoint('turn-1');
  const previousCheckpointBefore = JSON.stringify(previousCheckpoint);
  const invalidSummaryModel = new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: 'text', text: 'invalid summary' }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 10, text: 10, reasoning: 0 },
      },
      warnings: [],
    },
  });
  await assert.rejects(
    createContextCheckpoint({
      agentConfig: { model: invalidSummaryModel },
      rawMessages: checkpointHistory,
      turnIds: ['turn-1', 'turn-2', 'turn-3', 'turn-4', 'turn-5', 'turn-6'],
      existingCheckpoint: previousCheckpoint,
      reason: 'manual',
      abortSignal: new AbortController().signal,
    }),
    (error: unknown) => {
      assert.ok(error instanceof ContextCompactionError);
      assert.equal(error.stage, 'validation');
      assert.match(error.message, /missingOrOutOfOrder=/);
      assert.match(error.message, /finishReason=stop/);
      assert.equal(error.message.includes('invalid summary'), false, 'diagnostics must not expose summary content');
      return true;
    },
  );
  assert.equal(JSON.stringify(previousCheckpoint), previousCheckpointBefore, 'failed compaction must preserve the prior checkpoint');
  assert.equal(JSON.stringify(checkpointHistory), checkpointHistoryBefore, 'failed compaction must preserve durable messages');

  const emptyReasoningModel = new MockLanguageModelV3({
    doGenerate: {
      content: [],
      finishReason: { unified: 'length', raw: 'length' },
      usage: {
        inputTokens: { total: 500, noCache: 500, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 4_000, text: 0, reasoning: 4_000 },
      },
      warnings: [],
    },
  });
  await assert.rejects(
    createContextCheckpoint({
      agentConfig: { model: emptyReasoningModel },
      rawMessages: checkpointHistory,
      turnIds: ['turn-1', 'turn-2', 'turn-3', 'turn-4', 'turn-5', 'turn-6'],
      reason: 'preflight',
      contextWindow: 16_000,
      abortSignal: new AbortController().signal,
    }),
    (error: unknown) => {
      assert.ok(error instanceof ContextCompactionError);
      assert.equal(error.stage, 'validation');
      assert.match(error.message, /no visible summary text/);
      assert.match(error.message, /finishReason=length/);
      assert.match(error.message, /textTokens=0/);
      assert.match(error.message, /reasoningTokens=4000/);
      return true;
    },
  );
  assert.equal(emptyReasoningModel.doGenerateCalls[0].maxOutputTokens, 4_000);

  console.log('Context compaction checks passed');
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
