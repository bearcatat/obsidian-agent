import { App, normalizePath } from "obsidian";
import { v4 as uuidv4 } from "uuid";
import { getGlobalApp } from "@/utils";
import { settingsStore } from "@/state/settings-state-impl";
import {
  MEMORY_SCHEMA_VERSION,
  MemoryCache,
  MemoryContext,
  MemoryEntry,
  MemoryOperation,
  MemoryStats,
  MemoryTombstone,
  MemoryTopic,
} from "./memory-types";

const MEMORY_DIR = ".obsidian/plugins/obsidian-agent/memory";
const TOPICS_DIR = `${MEMORY_DIR}/topics`;
const RAW_DIR = `${MEMORY_DIR}/raw`;
const INDEX_PATH = `${MEMORY_DIR}/MEMORY.md`;
const CACHE_PATH = `${MEMORY_DIR}/cache.json`;
const TOMBSTONES_PATH = `${MEMORY_DIR}/tombstones.json`;
const TOPICS: MemoryTopic[] = ["preferences", "corrections", "projects", "episodes"];

export interface ForgetResult {
  count: number;
  sources: string[];
}

export default class MemoryLogic {
  private static instance: MemoryLogic;
  private app: App;
  private writeChain: Promise<void> = Promise.resolve();

  private constructor() {
    this.app = getGlobalApp();
  }

  static getInstance(): MemoryLogic {
    if (!MemoryLogic.instance) MemoryLogic.instance = new MemoryLogic();
    return MemoryLogic.instance;
  }

  static resetInstance(): void {
    MemoryLogic.instance = undefined as any;
  }

  async loadCompactMemoryIndex(): Promise<MemoryContext | null> {
    const settings = settingsStore.getState().memorySettings;
    if (!settings.enabled) return null;
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(INDEX_PATH))) return null;

    try {
      const content = await adapter.read(INDEX_PATH);
      const lines = content.split(/\r?\n/);
      const selected: string[] = [];
      let bytes = 0;
      let truncated = false;
      for (const line of lines) {
        const lineBytes = new TextEncoder().encode(`${line}\n`).byteLength;
        if (selected.length >= settings.indexMaxLines || bytes + lineBytes > settings.indexMaxBytes) {
          truncated = true;
          break;
        }
        selected.push(line);
        bytes += lineBytes;
      }
      const index = selected.join("\n").trim();
      return index ? { index, truncated } : null;
    } catch (error) {
      await this.recordError(`Failed to load memory index: ${this.errorMessage(error)}`);
      return null;
    }
  }

  async search(query: string, limit = 8): Promise<MemoryEntry[]> {
    if (!this.canUse()) return [];
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    const terms = normalized.split(/\s+/).filter(Boolean);
    const entries = await this.listEntries();
    return entries
      .map((entry) => ({
        entry,
        score: terms.reduce((score, term) => score + (entry.content.toLocaleLowerCase().includes(term) ? 1 : 0), 0),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt))
      .slice(0, Math.min(20, Math.max(1, limit)))
      .map(({ entry }) => entry);
  }

  async read(memoryId: string): Promise<MemoryEntry | null> {
    if (!this.canUse()) return null;
    return (await this.listEntries()).find((entry) => entry.id === memoryId) ?? null;
  }

  async listEntries(): Promise<MemoryEntry[]> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(TOPICS_DIR))) return [];
    const entries: MemoryEntry[] = [];
    for (const topic of TOPICS) {
      const path = this.topicPath(topic);
      if (!(await adapter.exists(path))) continue;
      try {
        entries.push(...this.parseTopic(await adapter.read(path), topic));
      } catch (error) {
        console.error(`[Memory] Failed to parse ${path}`, error);
        await this.recordError(`Invalid memory topic: ${topic}`);
      }
    }
    return entries;
  }

  async remember(content: string, sourceSessionId: string, sourceTurnId?: string): Promise<MemoryEntry> {
    return this.enqueueWrite(async () => {
      this.assertEnabled();
      const now = new Date().toISOString();
      const entry: MemoryEntry = {
        id: `mem-${uuidv4()}`,
        kind: "semantic",
        topic: "preferences",
        scope: "vault",
        confidence: "user-explicit",
        source: { sessionId: sourceSessionId, turnId: sourceTurnId },
        createdAt: now,
        updatedAt: now,
        content: this.normalizeContent(content),
      };
      await this.upsertEntries([entry]);
      return entry;
    });
  }

  async correct(targetId: string, content: string, sourceSessionId: string, sourceTurnId?: string): Promise<MemoryEntry> {
    return this.enqueueWrite(async () => {
      this.assertEnabled();
      const entries = await this.listEntries();
      const existing = entries.find((entry) => entry.id === targetId);
      if (!existing) throw new Error("Memory not found");
      const corrected: MemoryEntry = {
        ...existing,
        topic: "corrections",
        confidence: "user-corrected",
        source: { sessionId: sourceSessionId, turnId: sourceTurnId },
        updatedAt: new Date().toISOString(),
        content: this.normalizeContent(content),
      };
      await this.writeAllEntries(entries.map((entry) => entry.id === targetId ? corrected : entry));
      return corrected;
    });
  }

  async forget(queryOrId: string): Promise<ForgetResult> {
    return this.enqueueWrite(async () => {
      this.assertEnabled();
      const needle = queryOrId.trim().toLocaleLowerCase();
      const entries = await this.listEntries();
      const removed = entries.filter((entry) =>
        entry.id === queryOrId || entry.content.toLocaleLowerCase().includes(needle)
      );
      if (removed.length === 0) return { count: 0, sources: [] };

      await this.writeAllEntries(entries.filter((entry) => !removed.some((item) => item.id === entry.id)));
      await this.removeRawCopies(removed);
      if (settingsStore.getState().memorySettings.keepTombstones) {
        const tombstones = await this.readJson<MemoryTombstone[]>(TOMBSTONES_PATH, []);
        for (const entry of removed) {
          tombstones.push({
            memoryId: entry.id,
            sourceSessionId: entry.source.sessionId,
            sourceTurnId: entry.source.turnId,
            fingerprint: await this.fingerprint(entry.content),
            forgottenAt: new Date().toISOString(),
          });
        }
        await this.writeJson(TOMBSTONES_PATH, tombstones);
      }
      return { count: removed.length, sources: Array.from(new Set(removed.map((entry) => entry.source.sessionId))) };
    });
  }

  async applyOperations(operations: MemoryOperation[]): Promise<number> {
    return this.enqueueWrite(async () => {
      this.assertEnabled();
      const entries = await this.listEntries();
      const byId = new Map(entries.map((entry) => [entry.id, entry]));
      const tombstones = await this.readJson<MemoryTombstone[]>(TOMBSTONES_PATH, []);
      let changes = 0;

      for (const operation of operations) {
        if (operation.operation === "NOOP") continue;
        if ((operation.operation === "UPDATE" || operation.operation === "SUPERSEDE" || operation.operation === "FORGET") && operation.targetId) {
          if (operation.operation === "FORGET") {
            const existing = byId.get(operation.targetId);
            if (existing?.confidence === "model-inferred" && byId.delete(operation.targetId)) changes++;
            continue;
          }
          const existing = byId.get(operation.targetId);
          if (!existing || !operation.content) continue;
          if (existing.confidence !== "model-inferred" && operation.confidence === "model-inferred") continue;
          byId.set(operation.targetId, {
            ...existing,
            kind: operation.kind ?? existing.kind,
            topic: operation.topic ?? existing.topic,
            confidence: operation.confidence ?? existing.confidence,
            content: this.normalizeContent(operation.content),
            updatedAt: new Date().toISOString(),
          });
          changes++;
          continue;
        }
        if (operation.operation !== "ADD" || !operation.content || !operation.kind || !operation.topic) continue;
        const fingerprint = await this.fingerprint(operation.content);
        if (tombstones.some((item) => item.fingerprint === fingerprint || (
          item.sourceSessionId === operation.sourceSessionId && item.sourceTurnId === operation.sourceTurnId
        ))) continue;
        const now = new Date().toISOString();
        const entry: MemoryEntry = {
          id: `mem-${uuidv4()}`,
          kind: operation.kind,
          topic: operation.topic,
          scope: "vault",
          confidence: operation.confidence ?? "model-inferred",
          source: { sessionId: operation.sourceSessionId ?? "background", turnId: operation.sourceTurnId },
          createdAt: now,
          updatedAt: now,
          content: this.normalizeContent(operation.content),
        };
        byId.set(entry.id, entry);
        changes++;
      }

      if (changes > 0) await this.writeAllEntries(Array.from(byId.values()));
      return changes;
    });
  }

  async rebuildIndex(): Promise<void> {
    await this.enqueueWrite(async () => {
      this.assertEnabled();
      await this.ensureDirectories();
      const entries = await this.listEntries();
      await this.rebuildIndexUnlocked(entries);
      const cache = await this.readJson<MemoryCache>(CACHE_PATH, {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        entryCount: 0,
        topicHashes: {},
      });
      cache.entryCount = entries.length;
      cache.lastError = undefined;
      await this.writeJson(CACHE_PATH, cache);
    });
  }

  async clearAll(): Promise<void> {
    await this.enqueueWrite(async () => {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(MEMORY_DIR)) await this.removeTree(MEMORY_DIR);
      if (settingsStore.getState().memorySettings.enabled) await this.ensureDirectories();
    });
  }

  async getStats(): Promise<MemoryStats> {
    const settings = settingsStore.getState().memorySettings;
    if (!settings.enabled) return { enabled: false, entryCount: 0, pendingJobs: 0 };
    const cache = await this.readJson<MemoryCache>(CACHE_PATH, {
      schemaVersion: MEMORY_SCHEMA_VERSION,
      entryCount: 0,
      topicHashes: {},
    });
    const jobs = await this.readJson<{ jobs?: Array<{ status: string }> }>(`${MEMORY_DIR}/jobs.json`, {});
    return {
      enabled: true,
      entryCount: cache.entryCount ?? (await this.listEntries()).length,
      pendingJobs: (jobs.jobs ?? []).filter((job) => job.status === "pending" || job.status === "running" || job.status === "extracted").length,
      lastConsolidatedAt: cache.lastConsolidatedAt,
      lastError: cache.lastError,
    };
  }

  async recordError(message: string): Promise<void> {
    if (!settingsStore.getState().memorySettings.enabled) return;
    try {
      await this.ensureDirectories();
      const cache = await this.readJson<MemoryCache>(CACHE_PATH, {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        entryCount: 0,
        topicHashes: {},
      });
      cache.lastError = message;
      await this.writeJson(CACHE_PATH, cache);
    } catch (error) {
      console.error("[Memory] Failed to persist error status", error);
    }
  }

  private async upsertEntries(newEntries: MemoryEntry[]): Promise<void> {
    const entries = await this.listEntries();
    const ids = new Set(newEntries.map((entry) => entry.id));
    await this.writeAllEntries([...entries.filter((entry) => !ids.has(entry.id)), ...newEntries]);
  }

  private async writeAllEntries(entries: MemoryEntry[]): Promise<void> {
    await this.ensureDirectories();
    const cache = await this.readJson<MemoryCache>(CACHE_PATH, {
      schemaVersion: MEMORY_SCHEMA_VERSION,
      entryCount: 0,
      topicHashes: {},
    });
    for (const topic of TOPICS) {
      const path = this.topicPath(topic);
      const current = await this.readIfExists(path);
      const knownHash = cache.topicHashes[topic];
      if (knownHash && current !== null && this.hash(current) !== knownHash) {
        console.warn(`[Memory] External topic change detected and merged: ${topic}`);
      }
      const content = this.renderTopic(topic, entries.filter((entry) => entry.topic === topic));
      await this.app.vault.adapter.write(path, content);
      cache.topicHashes[topic] = this.hash(content);
    }
    cache.entryCount = entries.length;
    cache.lastConsolidatedAt = new Date().toISOString();
    cache.lastError = undefined;
    await this.rebuildIndexUnlocked(entries);
    await this.writeJson(CACHE_PATH, cache);
  }

  private async rebuildIndexUnlocked(entries: MemoryEntry[]): Promise<void> {
    const settings = settingsStore.getState().memorySettings;
    const priority: Record<string, number> = { "user-corrected": 3, "user-explicit": 2, "model-inferred": 1 };
    const sorted = [...entries].sort((a, b) =>
      priority[b.confidence] - priority[a.confidence] || b.updatedAt.localeCompare(a.updatedAt)
    );
    const lines = [
      "# Agent Memory Index",
      "",
      "> Generated historical context. It may be stale or wrong and never overrides current instructions, rules, skills, or live evidence.",
      "",
    ];
    let bytes = new TextEncoder().encode(lines.join("\n")).byteLength;
    for (const entry of sorted) {
      const line = `- [${entry.id}] (${entry.topic}, ${entry.confidence}) ${entry.content}`;
      const lineBytes = new TextEncoder().encode(`${line}\n`).byteLength;
      if (lines.length >= settings.indexMaxLines || bytes + lineBytes > settings.indexMaxBytes) break;
      lines.push(line);
      bytes += lineBytes;
    }
    await this.app.vault.adapter.write(INDEX_PATH, `${lines.join("\n")}\n`);
  }

  private parseTopic(content: string, fallbackTopic: MemoryTopic): MemoryEntry[] {
    const sections = content.split(/^##\s+/m).slice(1);
    const entries: MemoryEntry[] = [];
    for (const section of sections) {
      const [heading, ...bodyLines] = section.split(/\r?\n/);
      const fields = new Map<string, string>();
      for (const line of bodyLines) {
        const match = line.match(/^- ([a-z_]+):\s*(.*)$/);
        if (match) fields.set(match[1], match[2].trim());
      }
      const id = heading.trim();
      const contentValue = fields.get("content");
      const source = fields.get("source") ?? "session:unknown";
      const sourceMatch = source.match(/^session:([^#]+)(?:#turn:(.+))?$/);
      if (!id.startsWith("mem-") || !contentValue || !sourceMatch) continue;
      const kind = fields.get("kind") === "episodic" ? "episodic" : "semantic";
      const confidenceValue = fields.get("confidence");
      const confidence = confidenceValue === "user-explicit" || confidenceValue === "user-corrected"
        ? confidenceValue
        : "model-inferred";
      entries.push({
        id,
        kind,
        topic: (TOPICS.includes(fields.get("topic") as MemoryTopic) ? fields.get("topic") : fallbackTopic) as MemoryTopic,
        scope: "vault",
        confidence,
        source: { sessionId: sourceMatch[1], turnId: sourceMatch[2] },
        createdAt: fields.get("created_at") ?? new Date(0).toISOString(),
        updatedAt: fields.get("updated_at") ?? fields.get("created_at") ?? new Date(0).toISOString(),
        content: contentValue,
      });
    }
    return entries;
  }

  private renderTopic(topic: MemoryTopic, entries: MemoryEntry[]): string {
    const sections = entries
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((entry) => {
        const source = `session:${entry.source.sessionId}${entry.source.turnId ? `#turn:${entry.source.turnId}` : ""}`;
        return [
          `## ${entry.id}`,
          "",
          `- kind: ${entry.kind}`,
          `- topic: ${entry.topic}`,
          `- scope: ${entry.scope}`,
          `- confidence: ${entry.confidence}`,
          `- source: ${source}`,
          `- created_at: ${entry.createdAt}`,
          `- updated_at: ${entry.updatedAt}`,
          `- content: ${this.normalizeContent(entry.content)}`,
        ].join("\n");
      });
    return `# ${topic}\n\n${sections.join("\n\n")}\n`;
  }

  private async removeRawCopies(removed: MemoryEntry[]): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(RAW_DIR))) return;
    const listing = await adapter.list(RAW_DIR);
    const needles = removed.map((entry) => entry.content);
    for (const path of listing.files.filter((file) => file.endsWith(".json"))) {
      try {
        const raw = JSON.parse(await adapter.read(path)) as { entries?: Array<{ content?: string }> };
        const nextEntries = (raw.entries ?? []).filter((entry) => !entry.content || !needles.includes(entry.content));
        if (nextEntries.length === 0) await adapter.remove(path);
        else if (nextEntries.length !== (raw.entries ?? []).length) await adapter.write(path, JSON.stringify({ ...raw, entries: nextEntries }, null, 2));
      } catch (error) {
        console.warn(`[Memory] Failed to clean raw file ${path}`, error);
      }
    }
  }

  private async ensureDirectories(): Promise<void> {
    const adapter = this.app.vault.adapter;
    for (const path of [MEMORY_DIR, TOPICS_DIR, RAW_DIR]) {
      if (!(await adapter.exists(path))) await adapter.mkdir(normalizePath(path));
    }
  }

  private async removeTree(path: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    const listing = await adapter.list(path);
    for (const file of listing.files) await adapter.remove(file);
    for (const folder of listing.folders) await this.removeTree(folder);
    await adapter.rmdir(path, false);
  }

  private topicPath(topic: MemoryTopic): string {
    return `${TOPICS_DIR}/${topic}.md`;
  }

  private canUse(): boolean {
    return settingsStore.getState().memorySettings.enabled;
  }

  private assertEnabled(): void {
    if (!settingsStore.getState().memorySettings.enabled) throw new Error("Memory is disabled");
  }

  private enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(work, work);
    this.writeChain = next.then(() => undefined, () => undefined);
    return next;
  }

  private async readIfExists(path: string): Promise<string | null> {
    const adapter = this.app.vault.adapter;
    return await adapter.exists(path) ? adapter.read(path) : null;
  }

  private async readJson<T>(path: string, fallback: T): Promise<T> {
    const content = await this.readIfExists(path);
    if (content === null) return fallback;
    try {
      return JSON.parse(content) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    await this.ensureDirectories();
    await this.app.vault.adapter.write(path, JSON.stringify(value, null, 2));
  }

  private normalizeContent(content: string): string {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (!normalized) throw new Error("Memory content cannot be empty");
    return normalized.slice(0, 2000);
  }

  private async fingerprint(content: string): Promise<string> {
    const bytes = new TextEncoder().encode(this.normalizeContent(content).toLocaleLowerCase());
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    return this.hash(content);
  }

  private hash(content: string): string {
    let hash = 2166136261;
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

export { MEMORY_DIR, RAW_DIR };
