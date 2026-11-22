import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { clearTimeout, setTimeout } from 'node:timers';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const require = createRequire(import.meta.url);
const { StdioClientTransport: CommonJsTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function verifyClose(Transport, exitsOnStdinEnd) {
  const transport = new Transport({ command: 'unused-test-command' });
  const child = new EventEmitter();
  const signals = [];
  let stdinEnded = false;
  child.exitCode = null;
  const exit = () => queueMicrotask(() => {
    child.exitCode = 0;
    child.emit('close');
  });
  child.stdin = {
    end() {
      stdinEnded = true;
      if (exitsOnStdinEnd) exit();
    },
  };
  child.kill = (signal) => {
    signals.push(signal);
    exit();
  };
  transport._process = child;

  await transport.close();
  assert.equal(stdinEnded, true);
  assert.equal(child.exitCode, 0);
  assert.deepEqual(signals, exitsOnStdinEnd ? [] : ['SIGTERM']);
  assert.equal(transport._process, undefined);
}

const originalSetTimeout = globalThis.setTimeout;
const keepAlive = setTimeout(() => {}, 5_000);
try {
  // Obsidian's renderer returns numeric timer IDs without .unref().
  globalThis.setTimeout = () => 42;
  await verifyClose(StdioClientTransport, true);
  await verifyClose(CommonJsTransport, true);
  await verifyClose(StdioClientTransport, false);
} finally {
  globalThis.setTimeout = originalSetTimeout;
  clearTimeout(keepAlive);
}
console.log('MCP stdio closes cleanly with renderer timers and keeps the SIGTERM fallback.');
