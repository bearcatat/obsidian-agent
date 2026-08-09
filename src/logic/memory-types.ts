export const MEMORY_SCHEMA_VERSION = 1;

export type MemoryKind = "semantic" | "episodic";
export type MemoryConfidence = "user-explicit" | "user-corrected" | "model-inferred";
export type MemoryTopic = "preferences" | "corrections" | "projects" | "episodes";
export type MemoryOperationType = "ADD" | "UPDATE" | "SUPERSEDE" | "NOOP" | "FORGET";

export interface MemorySource {
  sessionId: string;
  turnId?: string;
}

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  topic: MemoryTopic;
  scope: "vault";
  confidence: MemoryConfidence;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
  content: string;
}

export interface MemoryContext {
  index: string;
  truncated: boolean;
}

export interface RawMemory {
  schemaVersion: number;
  sessionId: string;
  revision: number;
  extractedAt: string;
  entries: Array<Pick<MemoryEntry, "kind" | "topic" | "confidence" | "content"> & { turnId?: string }>;
}

export interface MemoryOperation {
  operation: MemoryOperationType;
  targetId?: string;
  kind?: MemoryKind;
  topic?: MemoryTopic;
  confidence?: MemoryConfidence;
  content?: string;
  sourceSessionId?: string;
  sourceTurnId?: string;
}

export interface MemoryTombstone {
  memoryId: string;
  sourceSessionId: string;
  sourceTurnId?: string;
  fingerprint: string;
  forgottenAt: string;
}

export interface MemoryJob {
  sessionId: string;
  revision: number;
  lastActivityAt: number;
  eligibleAt: number;
  attempts: number;
  status: "pending" | "running" | "extracted" | "done" | "failed";
  lastExtractedRevision?: number;
  excludedRevisions?: number[];
  forceExtraction?: boolean;
  error?: string;
}

export interface MemoryJobsFile {
  schemaVersion: number;
  jobs: MemoryJob[];
  budgetDate: string;
  callsUsed: number;
}

export interface MemoryCache {
  schemaVersion: number;
  entryCount: number;
  topicHashes: Record<string, string>;
  lastConsolidatedAt?: string;
  lastError?: string;
}

export interface MemoryStats {
  enabled: boolean;
  entryCount: number;
  pendingJobs: number;
  retryableJobs: number;
  lastConsolidatedAt?: string;
  lastError?: string;
}
