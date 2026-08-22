import { embed, embedMany } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { create, getByID, insert, search } from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";
import { TFile, TFolder } from "obsidian";
import type { App, Plugin, TAbstractFile } from "obsidian";
import { getGlobalApp } from "@/utils";
import type { EmbeddingModelConfig } from "@/types";

const RAG_ROOT = ".obsidian-agent/rag/models";
const MANIFEST_NAME = "manifest.json";
const INDEX_NAME = "index.bin";
const CHUNK_SIZE = 6000;

export type RagOperation = "idle" | "building" | "refreshing" | "rebuilding" | "canceled" | "available" | "error" | "disabled";

export interface RagStatus {
  operation: RagOperation;
  files: number;
  chunks: number;
  completed: number;
  total: number;
  pendingFiles: number;
  automatic: boolean;
  message?: string;
}

type RagStatusUpdate = Omit<RagStatus, "pendingFiles" | "automatic"> & { pendingFiles?: number; automatic?: boolean };

interface ChunkMetadata {
  id: string;
  startLine: number;
  endLine: number;
}

interface FileMetadata {
  path: string;
  contentHash: string;
  chunks: ChunkMetadata[];
}

interface RagManifest {
  version: 1;
  modelId: string;
  embeddingFingerprint: string;
  dimensions: number | null;
  generation: string | null;
  indexFile: string | null;
  files: FileMetadata[];
  updatedAt: number;
}

interface IndexedDocument {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  embedding: number[];
}

export interface RagHit {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  content?: string;
  failure?: "unreadable" | "stale";
}

export interface RagSearchResponse {
  state: "disabled" | "not-ready" | "empty" | "partial" | "success" | "failed";
  hits: RagHit[];
  message?: string;
}

export default class VaultRagService {
  private static instance: VaultRagService | undefined;
  private readonly listeners = new Set<() => void>();
  private model: EmbeddingModelConfig | null = null;
  private manifest: RagManifest | null = null;
  private database: any | null = null;
  private activeOperation: AbortController | null = null;
  private activeOperationModelId: string | null = null;
  private activeOperationDone: Promise<void> | null = null;
  private pendingUpdateCountPromise: Promise<number> | null = null;
  private status: RagStatus = { operation: "disabled", files: 0, chunks: 0, completed: 0, total: 0, pendingFiles: 0, automatic: false };
  private autoIndexStarted = false;
  private stopping = false;
  private debounceTimer: number | null = null;
  private lastChangeAt = 0;
  private dirty = false;
  private changeRevision = 0;
  private schedulerEpoch = 0;
  private autoSuppressedRevision: number | null = null;

  static getInstance(): VaultRagService {
    if (!VaultRagService.instance) VaultRagService.instance = new VaultRagService();
    return VaultRagService.instance;
  }

  static resetInstance(): void {
    VaultRagService.instance = undefined;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getStatus(): RagStatus {
    return { ...this.status };
  }

  /** Starts the plugin-lifetime Vault watcher. It intentionally does not wait for embedding requests. */
  start(plugin: Plugin): void {
    if (this.autoIndexStarted) return;
    this.autoIndexStarted = true;
    this.stopping = false;
    const vault = getGlobalApp().vault;
    plugin.registerEvent(vault.on("create", (file) => this.onVaultChanged(file)));
    plugin.registerEvent(vault.on("modify", (file) => this.onVaultChanged(file)));
    plugin.registerEvent(vault.on("delete", (file) => this.onVaultChanged(file)));
    plugin.registerEvent(vault.on("rename", (file, oldPath) => this.onVaultRenamed(file, oldPath)));
    void this.recoverAfterConfigure();
  }

  async shutdown(): Promise<void> {
    this.stopping = true;
    this.autoIndexStarted = false;
    this.schedulerEpoch++;
    this.clearDebounceTimer();
    this.cancel();
    await this.activeOperationDone;
  }

  async configure(model: EmbeddingModelConfig | null): Promise<void> {
    if (this.model?.id === model?.id && this.model?.name === model?.name && this.model?.baseUrl === model?.baseUrl && this.model?.apiKey === model?.apiKey) return;
    this.schedulerEpoch++;
    this.clearDebounceTimer();
    this.cancel();
    await this.activeOperationDone;
    this.pendingUpdateCountPromise = null;
    this.dirty = false;
    this.autoSuppressedRevision = null;
    this.model = model;
    this.manifest = null;
    this.database = null;
    if (!model) {
      this.setStatus({ operation: "disabled", files: 0, chunks: 0, completed: 0, total: 0, pendingFiles: 0, automatic: false });
      return;
    }
    try {
      await this.loadPublishedIndex();
    } catch {
      this.setStatus({ operation: "error", files: 0, chunks: 0, completed: 0, total: 0, pendingFiles: 0, automatic: false, message: "The published RAG index cannot be read. Rebuild it." });
    }
    if (this.autoIndexStarted) void this.recoverAfterConfigure();
  }

  async removeModel(modelId: string): Promise<void> {
    await this.cancelAndWaitForModelOperation(modelId);
    const directory = this.modelDirectory(modelId);
    await this.removeRagPath(directory);
  }

  /**
   * Counts files that an incremental refresh would add, replace, or remove.
   * This only reads Vault Markdown and manifest metadata; it never embeds.
   */
  async getPendingUpdateCount(): Promise<number> {
    if (this.pendingUpdateCountPromise) return this.pendingUpdateCountPromise;
    const pendingUpdateCountPromise = this.countPendingUpdates();
    this.pendingUpdateCountPromise = pendingUpdateCountPromise;
    try {
      return await pendingUpdateCountPromise;
    } finally {
      if (this.pendingUpdateCountPromise === pendingUpdateCountPromise) this.pendingUpdateCountPromise = null;
    }
  }

  private async countPendingUpdates(): Promise<number> {
    if (!this.model) return 0;
    const modelId = this.model.id;
    const manifest = this.manifest;
    const files = getGlobalApp().vault.getMarkdownFiles().filter((file) => !file.path.startsWith(".obsidian-agent/"));
    if (!manifest) return files.length;
    const manifestByPath = new Map(manifest.files.map((file) => [file.path, file]));
    const currentPaths = new Set(files.map((file) => file.path));
    const removed = manifest.files.filter((file) => !currentPaths.has(file.path));
    let pending = removed.length;

    const changed = await Promise.all(files.map(async (file) => {
      const current = await getGlobalApp().vault.read(file);
      const contentHash = await hash(current);
      return { path: file.path, contentHash, changed: manifestByPath.get(file.path)?.contentHash !== contentHash };
    }));
    const addedOrChanged = changed.filter((file) => file.changed);
    pending += addedOrChanged.length;
    // A live rename has no durable file identity. Pair unchanged hash removals/additions
    // so one renamed Markdown note counts once rather than as delete plus create.
    const removedByHash = new Map<string, number>();
    for (const file of removed) removedByHash.set(file.contentHash, (removedByHash.get(file.contentHash) ?? 0) + 1);
    for (const file of addedOrChanged) {
      const matchingRemoved = removedByHash.get(file.contentHash) ?? 0;
      if (matchingRemoved > 0) {
        pending--;
        removedByHash.set(file.contentHash, matchingRemoved - 1);
      }
    }

    // Do not return an out-of-date calculation after a model/index transition.
    return this.model?.id === modelId && this.manifest === manifest ? pending : 0;
  }

  cancel(): void {
    this.activeOperation?.abort();
  }

  private async cancelAndWaitForModelOperation(modelId: string): Promise<void> {
    if (!this.activeOperation || this.activeOperationModelId !== modelId) return;
    this.activeOperation.abort();
    await this.activeOperationDone;
  }

  async build(): Promise<void> {
    await this.run("building", true, false);
  }

  async refresh(): Promise<void> {
    await this.run("refreshing", false, false);
  }

  async rebuild(): Promise<void> {
    this.clearDebounceTimer();
    await this.run("rebuilding", true, false);
  }

  async search(query: string, limit = 5, abortSignal?: AbortSignal): Promise<RagSearchResponse> {
    if (!this.model) return { state: "disabled", hits: [], message: "RAG is disabled because no embedding model is selected." };
    if (!this.database || !this.manifest || this.manifest.dimensions === null) {
      return { state: "not-ready", hits: [], message: "The RAG index is not ready. Build the index first." };
    }
    try {
      const embedding = await this.embedOne(query, abortSignal);
      if (abortSignal?.aborted) throw new DOMException("Aborted", "AbortError");
      const result: any = await search(this.database, {
        mode: "vector",
        vector: { value: embedding, property: "embedding" },
        limit: Math.max(1, Math.min(10, limit)),
        similarity: 0,
      });
      if (!result.hits.length) return { state: "empty", hits: [] };
      const metadataByPath = new Map(this.manifest.files.map((file) => [file.path, file]));
      const hits = await Promise.all(result.hits.map(async (hit: any): Promise<RagHit> => {
        const document = hit.document as IndexedDocument;
        const metadata = metadataByPath.get(document.path);
        if (!metadata) return { path: document.path, startLine: document.startLine, endLine: document.endLine, score: hit.score, failure: "stale" };
        try {
          const file = getGlobalApp().vault.getAbstractFileByPath(document.path);
          if (!(file && "extension" in file && file.extension === "md")) throw new Error("not markdown");
          const content = await getGlobalApp().vault.read(file as TFile);
          if (await hash(content) !== metadata.contentHash) {
            return { path: document.path, startLine: document.startLine, endLine: document.endLine, score: hit.score, failure: "stale" };
          }
          return {
            path: document.path,
            startLine: document.startLine,
            endLine: document.endLine,
            score: hit.score,
            content: content.split(/\r?\n/).slice(document.startLine - 1, document.endLine).join("\n"),
          };
        } catch {
          return { path: document.path, startLine: document.startLine, endLine: document.endLine, score: hit.score, failure: "unreadable" };
        }
      }));
      const succeeded = hits.some((hit) => hit.content !== undefined);
      const failed = hits.some((hit) => hit.failure);
      return { state: succeeded ? (failed ? "partial" : "success") : "failed", hits, message: failed ? "Some matching notes could not be read or changed after indexing." : undefined };
    } catch (error) {
      if (isAbort(error)) throw error;
      return { state: "failed", hits: [], message: "Embedding the search query failed." };
    }
  }

  private onVaultChanged(file: TAbstractFile): void {
    if (!this.isRelevantVaultFile(file)) return;
    this.markChanged();
  }

  private onVaultRenamed(file: TAbstractFile, oldPath: string): void {
    if (!this.isRelevantVaultFile(file) && !isRagMarkdownPath(oldPath)) return;
    this.markChanged();
  }

  private isRelevantVaultFile(file: TAbstractFile): boolean {
    if (file instanceof TFile) return file.extension === "md" && isRagMarkdownPath(file.path);
    // A folder deletion/rename can be the only event emitted for several notes.
    return file instanceof TFolder && isRagMarkdownPath(file.path);
  }

  private markChanged(): void {
    if (!this.autoIndexStarted || this.stopping || !this.model) return;
    this.dirty = true;
    this.changeRevision++;
    this.autoSuppressedRevision = null;
    this.lastChangeAt = Date.now();
    void this.recountPendingUpdates();
    this.scheduleDrain();
  }

  private async recoverAfterConfigure(): Promise<void> {
    if (!this.autoIndexStarted || this.stopping || !this.model) return;
    const epoch = this.schedulerEpoch;
    const pending = await this.recountPendingUpdates();
    if (this.stopping || epoch !== this.schedulerEpoch || !this.model) return;
    if (!this.manifest) {
      this.dirty = true;
      void this.drain(true);
      return;
    }
    if (pending > 0) {
      this.dirty = true;
      this.lastChangeAt = Date.now();
      this.scheduleDrain();
    } else {
      this.dirty = false;
    }
  }

  private async recountPendingUpdates(): Promise<number> {
    const epoch = this.schedulerEpoch;
    const modelId = this.model?.id;
    try {
      const pendingFiles = await this.getPendingUpdateCount();
      if (epoch === this.schedulerEpoch && modelId === this.model?.id) this.setStatus({ ...this.status, pendingFiles });
      return pendingFiles;
    } catch {
      return this.status.pendingFiles;
    }
  }

  private scheduleDrain(): void {
    if (this.stopping || !this.model || !this.dirty) return;
    this.clearDebounceTimer();
    const delay = Math.max(0, this.lastChangeAt + 30_000 - Date.now());
    const epoch = this.schedulerEpoch;
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      if (epoch === this.schedulerEpoch) void this.drain(false);
    }, delay);
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  private async drain(immediately: boolean): Promise<void> {
    if (this.stopping || !this.model || !this.dirty) return;
    if (!immediately && Date.now() < this.lastChangeAt + 30_000) {
      this.scheduleDrain();
      return;
    }
    if (this.activeOperation) return;
    if (this.autoSuppressedRevision === this.changeRevision) return;
    const startRevision = this.changeRevision;
    const forceAll = !this.manifest;
    await this.run(forceAll ? "building" : "refreshing", forceAll, true, startRevision);
  }

  private async run(operation: Extract<RagOperation, "building" | "refreshing" | "rebuilding">, forceAll: boolean, automatic: boolean, startRevision = this.changeRevision): Promise<void> {
    if (!this.model) throw new Error("Select an embedding model before managing the index.");
    if (this.activeOperation) throw new Error("An index operation is already running.");
    this.pendingUpdateCountPromise = null;
    const controller = new AbortController();
    let resolveOperationDone!: () => void;
    const operationDone = new Promise<void>((resolve) => { resolveOperationDone = resolve; });
    this.activeOperation = controller;
    const model = this.model;
    const schedulerEpoch = this.schedulerEpoch;
    this.activeOperationModelId = model.id;
    this.activeOperationDone = operationDone;
    const app = getGlobalApp();
    const stage = `${this.modelDirectory(model.id)}/staging-${Date.now()}`;
    let succeeded = false;
    try {
      const files = app.vault.getMarkdownFiles().filter((file) => !file.path.startsWith(".obsidian-agent/"));
      this.setStatus({ operation, files: 0, chunks: 0, completed: 0, total: files.length, automatic });
      const candidate = forceAll ? null : await this.readManifest(model.id);
      const previous = candidate?.embeddingFingerprint === embeddingFingerprint(model) ? candidate : null;
      const previousDatabase = previous ? await this.readDatabase(model.id, previous) : null;
      const current = await Promise.all(files.map(async (file) => ({ file, content: await app.vault.read(file) })));
      this.throwIfCanceled(controller);
      const prepared = await Promise.all(current.map(async ({ file, content }) => ({ file, content, contentHash: await hash(content) })));
      const unchanged = new Map<string, FileMetadata>();
      if (previous && previousDatabase) {
        for (const item of prepared) {
          const old = previous.files.find((file) => file.path === item.file.path && file.contentHash === item.contentHash);
          if (old) unchanged.set(item.file.path, old);
        }
      }
      const changed = prepared.filter((item) => !unchanged.has(item.file.path));
      const chunksByPath = new Map<string, Array<ChunkMetadata & { text: string }>>();
      for (const item of changed) chunksByPath.set(item.file.path, chunk(item.file.basename, item.content, item.file.path));
      const allNewChunks = Array.from(chunksByPath.values()).flat();
      let dimensions = previous?.dimensions ?? null;
      let newEmbeddings: number[][] = [];
      if (allNewChunks.length) {
        const embedded = await this.embedMany(allNewChunks.map((item) => item.text), controller.signal);
        this.throwIfCanceled(controller);
        newEmbeddings = embedded;
        dimensions = embedded[0]?.length ?? null;
      }
      const database = dimensions === null ? null : createDatabase(dimensions);
      if (database && previousDatabase) {
        for (const oldFile of unchanged.values()) {
          for (const oldChunk of oldFile.chunks) {
            const document = await getByID(previousDatabase, oldChunk.id) as IndexedDocument | undefined;
            if (!document?.embedding) throw new Error("Published index is missing a vector.");
            await insert(database, document);
          }
        }
      }
      let embeddingIndex = 0;
      for (const item of prepared) {
        const chunks = chunksByPath.get(item.file.path);
        if (database && chunks) {
          for (const itemChunk of chunks) {
            const embedding = newEmbeddings[embeddingIndex++];
            if (!embedding || embedding.length !== dimensions) throw new Error("Embedding dimensions are inconsistent.");
            await insert(database, { id: itemChunk.id, path: item.file.path, startLine: itemChunk.startLine, endLine: itemChunk.endLine, embedding });
          }
        }
        this.setStatus({ operation, files: 0, chunks: 0, completed: this.status.completed + 1, total: prepared.length });
      }
      this.throwIfCanceled(controller);
      const generation = `generation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const manifest: RagManifest = {
        version: 1,
        modelId: model.id,
        embeddingFingerprint: embeddingFingerprint(model),
        dimensions,
        generation: database ? generation : null,
        indexFile: database ? `${generation}.bin` : null,
        files: prepared.map((item) => ({
          path: item.file.path,
          contentHash: item.contentHash,
          chunks: (chunksByPath.get(item.file.path) ?? unchanged.get(item.file.path)?.chunks ?? []).map(({ id, startLine, endLine }) => ({ id, startLine, endLine })),
        })),
        updatedAt: Date.now(),
      };
      await this.publish(stage, model.id, manifest, database, controller);
      if (this.model?.id !== model.id || schedulerEpoch !== this.schedulerEpoch) throw new DOMException("Aborted", "AbortError");
      this.manifest = manifest;
      this.database = database;
      this.setStatus({ operation: "available", files: manifest.files.length, chunks: countChunks(manifest), completed: manifest.files.length, total: manifest.files.length });
      succeeded = true;
    } catch (error) {
      if (isAbort(error) || controller.signal.aborted) {
        this.setStatus({ operation: "canceled", files: this.status.files, chunks: this.status.chunks, completed: this.status.completed, total: this.status.total, automatic, message: automatic ? "Automatic index operation was canceled." : undefined });
      } else {
        this.setStatus({ operation: "error", files: this.manifest?.files.length ?? 0, chunks: this.manifest ? countChunks(this.manifest) : 0, completed: 0, total: 0, automatic, message: automatic ? "Automatic index operation failed. The published index was kept unchanged." : "Index operation failed. The published index was kept unchanged." });
      }
    } finally {
      try {
        await this.removeRagPath(stage);
      } catch (error) {
        console.error(`[VaultRagService] Failed to clean temporary RAG path "${stage}":`, error);
      } finally {
        resolveOperationDone();
        if (this.activeOperation === controller) {
          this.activeOperation = null;
          this.activeOperationModelId = null;
          this.activeOperationDone = null;
        }
        if (!this.stopping && schedulerEpoch === this.schedulerEpoch && this.model?.id === model.id) {
          if (succeeded) {
            const pending = await this.recountPendingUpdates();
            this.dirty = pending > 0;
            if (this.dirty && this.changeRevision > startRevision) this.scheduleDrain();
          } else if (automatic) {
            this.autoSuppressedRevision = startRevision;
          }
        }
      }
    }
  }

  private async publish(stage: string, modelId: string, manifest: RagManifest, database: any | null, controller: AbortController): Promise<void> {
    const adapter = getGlobalApp().vault.adapter;
    const directory = this.modelDirectory(modelId);
    await ensureDirectory(adapter, RAG_ROOT);
    await ensureDirectory(adapter, directory);
    await ensureDirectory(adapter, stage);
    if (database && manifest.indexFile) {
      const serialized = await persist(database, "binary", "browser");
      this.throwIfCanceled(controller);
      await adapter.writeBinary(`${stage}/${INDEX_NAME}`, persistenceValueToArrayBuffer(serialized));
    }
    await adapter.write(`${stage}/${MANIFEST_NAME}`, JSON.stringify(manifest));
    this.throwIfCanceled(controller);
    const publishedManifest = `${directory}/${MANIFEST_NAME}`;
    if (database && manifest.indexFile) await adapter.rename(`${stage}/${INDEX_NAME}`, `${directory}/${manifest.indexFile}`);
    this.throwIfCanceled(controller);
    // This small JSON pointer is published only after its complete generation exists.
    // Older generation files stay intact until their embedding model is deleted.
    await adapter.write(publishedManifest, JSON.stringify(manifest));
  }

  private async loadPublishedIndex(): Promise<void> {
    if (!this.model) return;
    const manifest = await this.readManifest(this.model.id);
    if (!manifest) {
      this.setStatus({ operation: "disabled", files: 0, chunks: 0, completed: 0, total: 0, automatic: false, message: "No index has been built." });
      return;
    }
    if (manifest.embeddingFingerprint !== embeddingFingerprint(this.model)) {
      this.setStatus({ operation: "disabled", files: 0, chunks: 0, completed: 0, total: 0, automatic: false, message: "The selected embedding model changed. Rebuild the index." });
      return;
    }
    this.manifest = manifest;
    this.database = await this.readDatabase(this.model.id, manifest);
    this.setStatus({ operation: "available", files: manifest.files.length, chunks: countChunks(manifest), completed: manifest.files.length, total: manifest.files.length, automatic: false });
  }

  private async readManifest(modelId: string): Promise<RagManifest | null> {
    const adapter = getGlobalApp().vault.adapter;
    const path = `${this.modelDirectory(modelId)}/${MANIFEST_NAME}`;
    if (!await adapter.exists(path)) return null;
    const manifest = JSON.parse(await adapter.read(path)) as RagManifest;
    if (manifest.version !== 1 || manifest.modelId !== modelId || typeof manifest.embeddingFingerprint !== "string" || !Array.isArray(manifest.files) || !(manifest.indexFile === null || typeof manifest.indexFile === "string")) throw new Error("Invalid manifest");
    return manifest;
  }

  private async readDatabase(modelId: string, manifest: RagManifest): Promise<any | null> {
    if (manifest.dimensions === null) return null;
    const adapter = getGlobalApp().vault.adapter;
    if (!manifest.indexFile) throw new Error("Missing index pointer");
    const indexPath = `${this.modelDirectory(modelId)}/${manifest.indexFile}`;
    if (!await adapter.exists(indexPath)) throw new Error("Missing index");
    return restore("binary", arrayBufferToHex(await adapter.readBinary(indexPath)), "browser");
  }

  private async embedMany(values: string[], signal: AbortSignal): Promise<number[][]> {
    const model = this.requireModel();
    try {
      const provider = createOpenAICompatible({ name: "vault-rag", baseURL: model.baseUrl, apiKey: model.apiKey });
      const result = await embedMany({ model: provider.embeddingModel(model.name), values, abortSignal: signal, maxRetries: 0 });
      return result.embeddings;
    } catch (error) {
      if (isAbort(error) || signal.aborted) throw error;
      throw new Error("Embedding request failed.");
    }
  }

  private async embedOne(value: string, signal?: AbortSignal): Promise<number[]> {
    const model = this.requireModel();
    try {
      const provider = createOpenAICompatible({ name: "vault-rag", baseURL: model.baseUrl, apiKey: model.apiKey });
      const result = await embed({ model: provider.embeddingModel(model.name), value, abortSignal: signal, maxRetries: 0 });
      return result.embedding;
    } catch (error) {
      if (isAbort(error) || signal?.aborted) throw error;
      throw new Error("Embedding request failed.");
    }
  }

  private requireModel(): EmbeddingModelConfig {
    if (!this.model) throw new Error("No embedding model selected.");
    return this.model;
  }

  private modelDirectory(modelId: string): string {
    return `${RAG_ROOT}/${encodeURIComponent(modelId)}`;
  }

  private async removeRagPath(path: string): Promise<void> {
    const adapter = getGlobalApp().vault.adapter;
    if (!await adapter.exists(path)) return;

    const stat = await adapter.stat(path);
    if (!stat) {
      if (!await adapter.exists(path)) return;
      throw new Error(`Could not determine the type of RAG path "${path}".`);
    }

    if (stat.type === "file") {
      await adapter.remove(path);
      if (await adapter.exists(path)) throw new Error(`Failed to remove RAG file "${path}".`);
      return;
    }

    // Desktop FileSystemAdapter maps a non-recursive removal to Node's rm(),
    // which rejects directories with EISDIR. Recursive mode removes the whole
    // index tree in one adapter operation.
    await adapter.rmdir(path, true);
    if (await adapter.exists(path)) throw new Error(`Failed to remove RAG directory "${path}".`);
  }

  private throwIfCanceled(controller: AbortController): void {
    if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
  }

  private setStatus(status: RagStatusUpdate): void {
    this.status = { ...status, pendingFiles: status.pendingFiles ?? this.status.pendingFiles, automatic: status.automatic ?? this.status.automatic };
    this.listeners.forEach((listener) => listener());
  }
}

function createDatabase(dimensions: number): any {
  return create({ schema: { id: "string", path: "string", startLine: "number", endLine: "number", embedding: `vector[${dimensions}]` } });
}

function chunk(title: string, content: string, path: string): Array<ChunkMetadata & { text: string }> {
  const lines = content.split(/\r?\n/);
  const chunks: Array<ChunkMetadata & { text: string }> = [];
  let start = 0;
  while (start < lines.length) {
    let end = start;
    let size = 0;
    while (end < lines.length && (size + lines[end].length + 1 <= CHUNK_SIZE || end === start)) {
      size += lines[end].length + 1;
      end++;
    }
    const body = lines.slice(start, end).join("\n").trim();
    if (body) {
      const startLine = start + 1;
      const endLine = end;
      chunks.push({ id: `${encodeURIComponent(path)}:${startLine}:${endLine}`, startLine, endLine, text: `${title}\n\n${body}` });
    }
    start = Math.max(end, start + 1);
  }
  return chunks;
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureDirectory(adapter: App["vault"]["adapter"], path: string): Promise<void> {
  if (!await adapter.exists(path)) await adapter.mkdir(path);
}

function countChunks(manifest: RagManifest): number {
  return manifest.files.reduce((total, file) => total + file.chunks.length, 0);
}

function isRagMarkdownPath(path: string): boolean {
  return !path.startsWith(".obsidian-agent/");
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Keep Orama's official binary persistence bytes binary at the Vault boundary. */
function persistenceValueToArrayBuffer(value: string | ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (typeof value === "string") return hexToArrayBuffer(value);
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function hexToArrayBuffer(value: string): ArrayBuffer {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) throw new Error("Invalid Orama binary persistence payload.");
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes.buffer;
}

function arrayBufferToHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function embeddingFingerprint(model: EmbeddingModelConfig): string {
  return `${model.provider}|${model.id}|${model.name}|${model.baseUrl}`;
}
