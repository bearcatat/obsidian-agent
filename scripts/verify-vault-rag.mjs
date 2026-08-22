import { create, insert, search } from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";
import { transform } from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const db = await create({
  schema: {
    id: "string",
    path: "string",
    startLine: "number",
    endLine: "number",
    embedding: "vector[3]",
  },
});
await insert(db, { id: "sample", path: "sample.md", startLine: 1, endLine: 1, embedding: [1, 0, 0] });

const persisted = await persist(db, "binary", "browser");
const bytes = typeof persisted === "string"
  ? hexToBytes(persisted)
  : persisted instanceof ArrayBuffer
    ? new Uint8Array(persisted)
    : new Uint8Array(persisted.buffer, persisted.byteOffset, persisted.byteLength);
let storedBinary;
const adapter = {
  async writeBinary(_path, value) { storedBinary = value.slice(0); },
  async readBinary(_path) { return storedBinary.slice(0); },
};
await adapter.writeBinary(".obsidian-agent/rag/index.bin", bytes.buffer);
const restored = await restore("binary", bytesToHex(new Uint8Array(await adapter.readBinary(".obsidian-agent/rag/index.bin"))), "browser");
const result = await search(restored, {
  mode: "vector",
  vector: { value: [1, 0, 0], property: "embedding" },
  limit: 1,
  similarity: 0,
});

if (result.hits.length !== 1 || result.hits[0].document.path !== "sample.md") {
  throw new Error("Vault RAG Orama binary round-trip failed");
}
console.log("Vault RAG Orama binary round-trip passed");

const vaultRagServiceSource = await readFile(resolve("src/retrieval/VaultRagService.ts"), "utf8");
if (vaultRagServiceSource.includes("remove-rag-path")
  || vaultRagServiceSource.includes("makeDirectoryWritable")
  || vaultRagServiceSource.includes("node:fs/promises")) {
  throw new Error("Vault RAG cleanup must stay in VaultRagService without permission or attribute changes");
}
for (const requiredSource of [
  'start(plugin: Plugin)',
  'shutdown(): Promise<void>',
  'vault.on("rename"',
  'isRagMarkdownPath',
  'lastChangeAt + 30_000',
  'if (this.activeOperation) throw new Error("An index operation is already running.")',
  'autoSuppressedRevision',
  'pendingFiles',
]) {
  if (!vaultRagServiceSource.includes(requiredSource)) throw new Error(`Vault RAG automatic-index invariant is missing: ${requiredSource}`);
}
const { code: cleanupCode } = await transform(vaultRagServiceSource, {
  loader: "ts",
  format: "cjs",
});
const cleanupModule = { exports: {} };
let cleanupAdapter;
vm.runInNewContext(cleanupCode, {
  module: cleanupModule,
  exports: cleanupModule.exports,
  require(path) {
    if (path === "@/utils") return { getGlobalApp: () => ({ vault: { adapter: cleanupAdapter } }) };
    if (path === "obsidian") return { TFile: class TFile {}, TFolder: class TFolder {} };
    if (path === "ai" || path === "@ai-sdk/openai-compatible" || path === "@orama/orama" || path === "@orama/plugin-data-persistence") return {};
    throw new Error(`Unexpected module request: ${path}`);
  },
  AbortController,
  DOMException,
  console,
  encodeURIComponent,
});

const cleanupService = cleanupModule.exports.default.getInstance();
cleanupAdapter = createCleanupAdapter();
await cleanupService.removeModel("rag-cleanup-test");
if (await cleanupAdapter.exists(".obsidian-agent/rag/models/rag-cleanup-test")) {
  throw new Error("Vault RAG cleanup left the embedding-model root directory behind");
}
if (cleanupAdapter.rmdirCalls.some((recursive) => recursive !== true) || cleanupAdapter.rmdirCalls.length !== 1) {
  throw new Error("Vault RAG cleanup used non-recursive rmdir() for a directory");
}
await cleanupService.removeRagPath(".obsidian-agent/rag/models/orphan.bin");
if (await cleanupAdapter.exists(".obsidian-agent/rag/models/orphan.bin") || !cleanupAdapter.removedFiles.includes(".obsidian-agent/rag/models/orphan.bin")) {
  throw new Error("Vault RAG cleanup did not use remove() for a file");
}
const failingCleanupAdapter = {
  rmdirCalls: 0,
  async exists() { return true; },
  async stat() { return { type: "folder" }; },
  async rmdir(_path, recursive) {
    this.rmdirCalls++;
    if (recursive !== true) throw new Error("Expected recursive rmdir");
    throw new Error("EPERM: operation not permitted");
  },
};
try {
  cleanupAdapter = failingCleanupAdapter;
  await cleanupService.removeRagPath(".obsidian-agent/rag/models/locked");
  throw new Error("Vault RAG cleanup unexpectedly succeeded for a locked directory");
} catch (error) {
  if (failingCleanupAdapter.rmdirCalls !== 1 || !String(error).includes("EPERM")) throw error;
}
console.log("Vault RAG cleanup passed");

const settingsLogicSource = await readFile(resolve("src/logic/settings-logic.tsx"), "utf8");
if (settingsLogicSource.includes("cleanupAfterReload")
  || vaultRagServiceSource.includes("cleanupAfterReload")
  || settingsLogicSource.includes("embeddingModelIndexCleanupFailed")) {
  throw new Error("Vault RAG reload cleanup or user-facing cleanup failure feedback is still enabled");
}
console.log("Vault RAG deletion-only cleanup wiring passed");

const mainSource = await readFile(resolve("src/main.ts"), "utf8");
if (!mainSource.includes("VaultRagService.getInstance().start(this)")
  || !mainSource.includes("await VaultRagService.getInstance().shutdown()")) {
  throw new Error("Vault RAG watcher is not wired to the plugin lifecycle");
}
const vaultRagSettingSource = await readFile(resolve("src/ui/components/settings/tabs/vault-rag-setting.tsx"), "utf8");
if (vaultRagSettingSource.includes("ragIncrementalRefresh")
  || vaultRagSettingSource.includes(".refresh()")
  || !vaultRagSettingSource.includes(".rebuild()")
  || !vaultRagSettingSource.includes("ragPendingFiles")) {
  throw new Error("Vault RAG settings must expose rebuild and service pending state, without manual refresh");
}
console.log("Vault RAG automatic-index wiring passed");

function hexToBytes(value) {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) throw new Error("Invalid persistence hex");
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function bytesToHex(value) {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createCleanupAdapter() {
  const root = ".obsidian-agent/rag/models/rag-cleanup-test";
  const entries = new Map([
    [root, "folder"],
    [`${root}/generation-1.bin`, "file"],
    [`${root}/staging-123`, "folder"],
    [`${root}/staging-123/index.bin`, "file"],
    [`${root}/staging-123/metadata`, "folder"],
    [`${root}/staging-123/metadata/manifest.json`, "file"],
    [".obsidian-agent/rag/models/orphan.bin", "file"],
  ]);
  const removedFiles = [];
  const removedDirectories = [];
  const rmdirCalls = [];

  return {
    removedFiles,
    removedDirectories,
    rmdirCalls,
    async exists(path) { return entries.has(path); },
    async stat(path) {
      const type = entries.get(path);
      return type ? { type } : null;
    },
    async remove(path) {
      if (entries.get(path) !== "file") throw new Error(`EISDIR: illegal operation on a directory, unlink '${path}'`);
      entries.delete(path);
      removedFiles.push(path);
    },
    async rmdir(path, recursive) {
      rmdirCalls.push(recursive);
      if (recursive !== true) throw new Error(`EISDIR: illegal operation on a directory, rm '${path}'`);
      if (entries.get(path) !== "folder") throw new Error(`ENOTDIR: not a directory, rmdir '${path}'`);
      for (const entry of [...entries.keys()]) {
        if (entry === path || entry.startsWith(`${path}/`)) entries.delete(entry);
      }
      removedDirectories.push(path);
    },
  };
}
