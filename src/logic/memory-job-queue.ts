import { App } from "obsidian";
import { Output, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getGlobalApp } from "@/utils";
import { settingsStore } from "@/state/settings-state-impl";
import { getAvailableVariants, getDefaultVariant, ModelConfig, ModelVariant } from "@/types";
import AIModelManager from "@/llm/ModelManager";
import { SessionData, SessionLogic } from "./session-logic";
import MemoryLogic, { MEMORY_DIR, RAW_DIR } from "./memory-logic";
import {
  MEMORY_SCHEMA_VERSION,
  MemoryJob,
  MemoryJobsFile,
  MemoryOperation,
  RawMemory,
} from "./memory-types";

const JOBS_PATH = `${MEMORY_DIR}/jobs.json`;
const TICK_INTERVAL_MS = 60_000;
const BACKGROUND_BATCH_LIMIT = 16;

const extractionOutputSchema = z.object({
  entries: z.array(z.object({
    kind: z.enum(["semantic", "episodic"]),
    topic: z.enum(["preferences", "corrections", "projects", "episodes"]),
    turnId: z.string().nullable(),
    content: z.string().min(1),
  }).strict()).max(12),
}).strict();

const consolidationOutputSchema = z.object({
  operations: z.array(z.object({
    operation: z.enum(["ADD", "UPDATE", "SUPERSEDE", "NOOP", "FORGET"]),
    targetId: z.string().nullable(),
    kind: z.enum(["semantic", "episodic"]).nullable(),
    topic: z.enum(["preferences", "corrections", "projects", "episodes"]).nullable(),
    content: z.string().nullable(),
    sourceSessionId: z.string().nullable(),
    sourceTurnId: z.string().nullable(),
  }).strict()).max(64),
}).strict();

export default class MemoryJobQueue {
  private static instance: MemoryJobQueue;
  private app: App;
  private state: MemoryJobsFile | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private abortController: AbortController | null = null;
  private persistChain: Promise<void> = Promise.resolve();

  private constructor() {
    this.app = getGlobalApp();
  }

  static getInstance(): MemoryJobQueue {
    if (!MemoryJobQueue.instance) MemoryJobQueue.instance = new MemoryJobQueue();
    return MemoryJobQueue.instance;
  }

  static resetInstance(): void {
    MemoryJobQueue.instance = undefined as any;
  }

  async start(): Promise<void> {
    this.stopTimer();
    const settings = settingsStore.getState().memorySettings;
    if (!settings.enabled) return;
    await this.load();
    this.schedule(0);
  }

  async configure(): Promise<void> {
    const settings = settingsStore.getState().memorySettings;
    if (settings.enabled) await this.start();
    else await this.shutdown();
  }

  async shutdown(): Promise<void> {
    this.stopTimer();
    this.abortController?.abort();
    this.abortController = null;
    if (this.state) await this.persist();
  }

  async markSessionDirty(sessionId: string, revision: number, lastActivityAt: number): Promise<void> {
    const settings = settingsStore.getState().memorySettings;
    if (!settings.enabled) return;
    await this.load();
    const existing = this.state!.jobs.find((job) => job.sessionId === sessionId);
    if (existing?.excludedRevisions?.includes(revision)) return;
    const eligibleAt = lastActivityAt + settings.idleHours * 60 * 60 * 1000;
    if (existing) {
      if (existing.lastExtractedRevision === revision && existing.status === "done") return;
      existing.revision = revision;
      existing.lastActivityAt = lastActivityAt;
      existing.eligibleAt = eligibleAt;
      existing.attempts = 0;
      existing.status = "pending";
      existing.forceExtraction = undefined;
      existing.error = undefined;
    } else {
      this.state!.jobs.push({
        sessionId,
        revision,
        lastActivityAt,
        eligibleAt,
        attempts: 0,
        status: "pending",
      });
    }
    await this.persist();
    this.scheduleNext();
  }

  async excludeSources(sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    await this.load();
    if (this.state!.jobs.some((job) => sessionIds.includes(job.sessionId) && (job.status === "pending" || job.status === "running" || job.status === "extracted"))) {
      this.abortController?.abort();
    }
    for (const job of this.state!.jobs) {
      if (!sessionIds.includes(job.sessionId)) continue;
      job.excludedRevisions = Array.from(new Set([...(job.excludedRevisions ?? []), job.revision]));
      job.status = "done";
      job.forceExtraction = undefined;
      job.error = undefined;
    }
    await this.persist();
  }

  async clear(): Promise<void> {
    this.stopTimer();
    this.abortController?.abort();
    this.state = this.emptyState();
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(JOBS_PATH)) await adapter.remove(JOBS_PATH);
  }

  async retryFailedJobs(): Promise<number> {
    if (!settingsStore.getState().memorySettings.enabled) return 0;
    await this.load();
    const retryableJobs = this.state!.jobs.filter((job) =>
      Boolean(job.error) && (job.status === "pending" || job.status === "extracted" || job.status === "failed")
    );
    if (retryableJobs.length === 0) return 0;

    const now = Date.now();
    for (const job of retryableJobs) {
      const hasRawExtraction = await this.app.vault.adapter.exists(this.rawPath(job));
      job.status = hasRawExtraction ? "extracted" : "pending";
      if (!hasRawExtraction && job.lastExtractedRevision === job.revision) {
        job.lastExtractedRevision = undefined;
      }
      job.attempts = 0;
      job.eligibleAt = now;
      job.error = undefined;
    }

    await this.persist();
    await MemoryLogic.getInstance().clearError();
    this.schedule(0);
    return retryableJobs.length;
  }

  async triggerSessionExtraction(sessionId: string): Promise<void> {
    if (!__DEV__) {
      throw new Error("Debug extraction is only available in development builds");
    }
    if (!settingsStore.getState().memorySettings.enabled) {
      throw new Error("Memory is disabled");
    }

    const session = await SessionLogic.getInstance().readSessionData(sessionId);
    if (!session || session.turns.length === 0) {
      throw new Error("Saved session is empty or unavailable");
    }

    await this.load();
    if (this.running) {
      throw new Error("Memory background processing is running; try again shortly");
    }
    this.stopTimer();
    const revision = session.updatedAt;
    const existing = this.state!.jobs.find((job) => job.sessionId === sessionId);
    if (existing?.excludedRevisions?.includes(revision)) {
      throw new Error("This session revision was explicitly excluded from memory");
    }
    if (existing?.status === "running") {
      throw new Error("This session is already being extracted");
    }

    const adapter = this.app.vault.adapter;
    const rawFiles = await adapter.exists(RAW_DIR) ? (await adapter.list(RAW_DIR)).files : [];
    for (const path of rawFiles) {
      if (path.startsWith(`${RAW_DIR}/${sessionId}-`) && await adapter.exists(path)) {
        await adapter.remove(path);
      }
    }

    const now = Date.now();
    if (existing) {
      existing.revision = revision;
      existing.lastActivityAt = session.updatedAt;
      existing.eligibleAt = now;
      existing.attempts = 0;
      existing.status = "pending";
      existing.forceExtraction = true;
      existing.error = undefined;
      existing.lastExtractedRevision = undefined;
    } else {
      this.state!.jobs.push({
        sessionId,
        revision,
        lastActivityAt: session.updatedAt,
        eligibleAt: now,
        attempts: 0,
        status: "pending",
        forceExtraction: true,
      });
    }

    await this.persist();
    await MemoryLogic.getInstance().clearError();
    this.schedule(0);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    const settings = settingsStore.getState().memorySettings;
    if (!settings.enabled) return;
    this.running = true;
    this.abortController = new AbortController();
    try {
      await this.load();
      this.resetDailyBudget();
      const now = Date.now();
      this.pruneOldJobs(now);
      const due = this.state!.jobs
        .filter((job) => job.status === "pending" && job.eligibleAt <= now && job.lastExtractedRevision !== job.revision)
        .slice(0, BACKGROUND_BATCH_LIMIT);

      for (const job of due) {
        if (!this.hasBudget(1) || this.abortController.signal.aborted) break;
        await this.extract(job);
      }

      const rawFiles = await this.listRawFiles();
      const extractedJobs = this.state!.jobs.filter((job) => job.status === "extracted");
      const consolidationDue = extractedJobs.some((job) => job.eligibleAt <= now) || extractedJobs.length === 0;
      if (rawFiles.length > 0 && consolidationDue && this.hasBudget(1) && !this.abortController.signal.aborted) {
        try {
          await this.consolidate(rawFiles);
        } catch (error) {
          if (!this.abortController.signal.aborted) {
            for (const job of this.state!.jobs.filter((item) => item.status === "extracted")) {
              job.attempts++;
              job.error = this.errorMessage(error);
              job.status = job.attempts > settings.maxRetries ? "failed" : "extracted";
              job.eligibleAt = Date.now() + Math.min(6, Math.max(1, job.attempts)) * 60 * 60 * 1000;
            }
            await MemoryLogic.getInstance().recordError(`Consolidation failed: ${this.errorMessage(error)}`);
          }
        }
      }
      await this.persist();
    } catch (error) {
      console.error("[MemoryQueue] Background processing failed", error);
      await MemoryLogic.getInstance().recordError(this.errorMessage(error));
    } finally {
      this.abortController = null;
      this.running = false;
      this.scheduleNext();
    }
  }

  private async extract(job: MemoryJob): Promise<void> {
    const settings = settingsStore.getState().memorySettings;
    job.status = "running";
    await this.persist();
    try {
      const session = await SessionLogic.getInstance().readSessionData(job.sessionId);
      if (!session || job.excludedRevisions?.includes(job.revision)) {
        job.status = "done";
        job.lastExtractedRevision = job.revision;
        job.forceExtraction = undefined;
        return;
      }
      const transcript = this.sessionTranscript(session);
      const messageCount = session.turns.reduce((count, turn) => count + 1 + (turn.assistantMessages?.length ?? 0), 0);
      const belowContentThreshold = messageCount < settings.minMessages || transcript.length < settings.minTextChars;
      const forceExtraction = __DEV__ && job.forceExtraction;
      if ((!forceExtraction && belowContentThreshold) || this.containsSensitiveData(transcript)) {
        job.status = "done";
        job.lastExtractedRevision = job.revision;
        job.forceExtraction = undefined;
        return;
      }

      const model = this.resolveModel(settings.extractModelId);
      if (!model) throw new Error("No model is configured for memory extraction");
      const variant = this.resolveVariant(model, settings.extractModelVariant);
      const agentConfig = AIModelManager.getInstance().buildAgentConfig(model, variant ?? undefined);
      const agent = new ToolLoopAgent({
        ...agentConfig,
        instructions: `Extract durable memory from a completed session. Output JSON only and match the provided JSON schema exactly. Use this shape: {"entries":[{"kind":"semantic|episodic","topic":"preferences|corrections|projects|episodes","turnId":"turn id or null","content":"atomic memory"}]}. Return {"entries":[]} when nothing is worth remembering. Do not include Markdown fences or prose outside the JSON object. Never save secrets, credentials, reasoning, long quotes, tool output, or facts that can be read from current files/settings. Prefer stable preferences, explicit corrections, durable agreements, and compact reusable task outcomes.`,
        output: Output.object({
          schema: extractionOutputSchema,
          name: "memory_extraction",
          description: "Durable memory entries extracted from one completed session",
        }),
        maxRetries: 1,
      });
      const result = await agent.generate({
        prompt: transcript.slice(0, 60_000),
        abortSignal: this.abortController?.signal,
      });
      this.consumeBudget();
      const entries = result.output.entries
        .filter((entry) => !this.containsSensitiveData(entry.content))
        .map((entry) => ({ ...entry, turnId: entry.turnId ?? undefined }));
      job.lastExtractedRevision = job.revision;
      if (entries.length === 0) {
        job.status = "done";
        job.forceExtraction = undefined;
        return;
      }
      const raw: RawMemory = {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        sessionId: job.sessionId,
        revision: job.revision,
        extractedAt: new Date().toISOString(),
        entries: entries.map((entry) => ({ ...entry, confidence: "model-inferred" })),
      };
      await this.ensureDirectories();
      await this.app.vault.adapter.write(this.rawPath(job), JSON.stringify(raw, null, 2));
      job.status = "extracted";
      job.attempts = 0;
      job.error = undefined;
    } catch (error) {
      if (this.abortController?.signal.aborted) {
        job.status = job.excludedRevisions?.includes(job.revision) ? "done" : "pending";
        return;
      }
      job.attempts++;
      job.error = this.errorMessage(error);
      job.status = job.attempts > settings.maxRetries ? "failed" : "pending";
      job.eligibleAt = Date.now() + Math.min(6, Math.max(1, job.attempts)) * 60 * 60 * 1000;
      await MemoryLogic.getInstance().recordError(`Extraction failed for ${job.sessionId}: ${job.error}`);
    }
  }

  private async consolidate(rawFiles: string[]): Promise<void> {
    const settings = settingsStore.getState().memorySettings;
    const raws: RawMemory[] = [];
    for (const path of rawFiles.slice(0, BACKGROUND_BATCH_LIMIT)) {
      try {
        raws.push(JSON.parse(await this.app.vault.adapter.read(path)) as RawMemory);
      } catch (error) {
        console.warn(`[MemoryQueue] Invalid raw memory file: ${path}`, error);
      }
    }
    if (raws.length === 0) return;
    const model = this.resolveModel(settings.consolidationModelId);
    if (!model) throw new Error("No model is configured for memory consolidation");
    const existing = (await MemoryLogic.getInstance().listEntries()).slice(0, 256);
    const variant = this.resolveVariant(model, settings.consolidationModelVariant);
    const agentConfig = AIModelManager.getInstance().buildAgentConfig(model, variant ?? undefined);
    const agent = new ToolLoopAgent({
      ...agentConfig,
      instructions: `Consolidate raw memories into durable memory operations. Output JSON only and match the provided JSON schema exactly. Use this shape: {"operations":[{"operation":"ADD|UPDATE|SUPERSEDE|NOOP|FORGET","targetId":"memory id or null","kind":"semantic|episodic or null","topic":"preferences|corrections|projects|episodes or null","content":"atomic memory or null","sourceSessionId":"session id or null","sourceTurnId":"turn id or null"}]}. Use null for fields that do not apply. Do not include Markdown fences or prose outside the JSON object. Deduplicate aggressively. Preserve user-explicit and user-corrected entries unless a newer explicit correction requires replacement. Do not invent facts. Prefer NOOP over low-value memory.`,
      output: Output.object({
        schema: consolidationOutputSchema,
        name: "memory_consolidation",
        description: "Validated operations for consolidating durable memory",
      }),
      maxRetries: 1,
    });
    const result = await agent.generate({
      prompt: JSON.stringify({ existing, raw: raws }).slice(0, 80_000),
      abortSignal: this.abortController?.signal,
    });
    this.consumeBudget();
    const sourceIds = new Set(raws.map((raw) => raw.sessionId));
    const fallbackSourceId = raws[0].sessionId;
    const operations: MemoryOperation[] = result.output.operations.map((operation) => ({
      operation: operation.operation,
      targetId: operation.targetId ?? undefined,
      kind: operation.kind ?? undefined,
      topic: operation.topic ?? undefined,
      confidence: "model-inferred" as const,
      content: operation.content ?? undefined,
      sourceSessionId: operation.sourceSessionId && sourceIds.has(operation.sourceSessionId)
        ? operation.sourceSessionId
        : fallbackSourceId,
      sourceTurnId: operation.sourceTurnId ?? undefined,
    }));
    const changes = await MemoryLogic.getInstance().applyOperations(operations);
    for (const path of rawFiles.slice(0, BACKGROUND_BATCH_LIMIT)) {
      if (await this.app.vault.adapter.exists(path)) await this.app.vault.adapter.remove(path);
    }
    for (const raw of raws) {
      const job = this.state!.jobs.find((item) => item.sessionId === raw.sessionId && item.revision === raw.revision);
      if (job) {
        job.status = "done";
        job.forceExtraction = undefined;
        job.error = undefined;
      }
    }
    console.info(`[MemoryQueue] Consolidated ${raws.length} raw files with ${changes} changes`);
  }

  private async load(): Promise<void> {
    if (this.state) return;
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(JOBS_PATH))) {
      this.state = this.emptyState();
      return;
    }
    try {
      const parsed = JSON.parse(await adapter.read(JOBS_PATH)) as MemoryJobsFile;
      this.state = {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs.map((job) => job.status === "running" ? { ...job, status: "pending" } : job) : [],
        budgetDate: parsed.budgetDate || this.today(),
        callsUsed: parsed.callsUsed || 0,
      };
    } catch {
      this.state = this.emptyState();
    }
  }

  private persist(): Promise<void> {
    if (!this.state) return Promise.resolve();
    const snapshot = JSON.stringify(this.state, null, 2);
    this.persistChain = this.persistChain.then(async () => {
      await this.ensureDirectories();
      await this.app.vault.adapter.write(JOBS_PATH, snapshot);
    });
    return this.persistChain;
  }

  private async ensureDirectories(): Promise<void> {
    const adapter = this.app.vault.adapter;
    for (const path of [MEMORY_DIR, RAW_DIR]) {
      if (!(await adapter.exists(path))) await adapter.mkdir(path);
    }
  }

  private async listRawFiles(): Promise<string[]> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(RAW_DIR))) return [];
    const files = (await adapter.list(RAW_DIR)).files.filter((path) => path.endsWith(".json")).sort();
    const overflow = files.slice(0, Math.max(0, files.length - 256));
    for (const path of overflow) await adapter.remove(path);
    return files.slice(overflow.length);
  }

  private sessionTranscript(session: SessionData): string {
    const lines: string[] = [];
    for (const turn of session.turns) {
      lines.push(`TURN ${turn.id}`);
      lines.push(`USER: ${String(turn.userMessage?.content ?? "")}`);
      for (const message of turn.assistantMessages ?? []) {
        if (message.role === "assistant" && message.content) lines.push(`ASSISTANT: ${message.content}`);
      }
    }
    return lines.join("\n");
  }

  private containsSensitiveData(content: string): boolean {
    const patterns = [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
      /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret)\b\s*[:=]\s*[^\s]{6,}/i,
      /\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/,
      /\b\d{17}[\dXx]\b/,
    ];
    return patterns.some((pattern) => pattern.test(content));
  }

  private resolveModel(modelId: string) {
    const state = settingsStore.getState();
    return state.models.find((model) => model.id === modelId) ?? state.defaultAgentModel ?? state.models[0] ?? null;
  }

  private resolveVariant(model: ModelConfig, variant: ModelVariant | null): ModelVariant | null {
    const variants = getAvailableVariants(model);
    if (!variants) return null;
    return variants.some((option) => option.value === variant) ? variant : getDefaultVariant(model);
  }

  private scheduleNext(): void {
    const settings = settingsStore.getState().memorySettings;
    if (!settings.enabled) return;
    const nextEligible = this.state?.jobs
      .filter((job) => job.status === "pending")
      .reduce((minimum, job) => Math.min(minimum, job.eligibleAt), Number.POSITIVE_INFINITY);
    const delay = Number.isFinite(nextEligible)
      ? Math.min(TICK_INTERVAL_MS, Math.max(1000, nextEligible! - Date.now()))
      : TICK_INTERVAL_MS;
    this.schedule(delay);
  }

  private schedule(delay: number): void {
    this.stopTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick();
    }, delay);
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private resetDailyBudget(): void {
    if (!this.state) return;
    const today = this.today();
    if (this.state.budgetDate !== today) {
      this.state.budgetDate = today;
      this.state.callsUsed = 0;
    }
  }

  private hasBudget(calls: number): boolean {
    return (this.state?.callsUsed ?? 0) + calls <= settingsStore.getState().memorySettings.dailyCallLimit;
  }

  private consumeBudget(): void {
    if (this.state) this.state.callsUsed++;
  }

  private rawPath(job: MemoryJob): string {
    return `${RAW_DIR}/${job.sessionId}-${job.revision}.json`;
  }

  private emptyState(): MemoryJobsFile {
    return { schemaVersion: MEMORY_SCHEMA_VERSION, jobs: [], budgetDate: this.today(), callsUsed: 0 };
  }

  private pruneOldJobs(now: number): void {
    if (!this.state) return;
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;
    this.state.jobs = this.state.jobs.filter((job) =>
      job.lastActivityAt >= cutoff || job.status === "pending" || job.status === "running" || job.status === "extracted"
    );
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
