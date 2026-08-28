/// <reference types="node" />
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AclWriteGrant, tempWriteSid, workspaceWriteSid } from '@deepseek-ai/dsh-sandbox-windows-acl';
import { prepareEmbeddedKoffi } from './koffi-runtime';

const CONVERSATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHUTDOWN_DRAIN_MS = 1_500;

type Scope = {
  vaultRoot: string;
  tempRoot: string;
  scopeRoot: string;
};

type SessionEntry = {
  conversationId: string;
  tempDir: string;
  tempSid: string;
  grant?: AclWriteGrant;
  initPromise?: Promise<void>;
  activeCount: number;
  retiring: boolean;
  cleanupPromise?: Promise<void>;
};

export type BashSessionTempLease = {
  tempDir: string;
  tempWriteSid: string;
  writeSid: string;
  release: () => Promise<void>;
};

function normalized(value: string): string {
  return path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
}

function samePath(left: string, right: string): boolean {
  return normalized(left) === normalized(right);
}

function isStrictChild(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function isDirectChild(parent: string, candidate: string): boolean {
  return isStrictChild(parent, candidate) && path.dirname(candidate) === parent;
}

function assertDisjoint(left: string, right: string): void {
  if (samePath(left, right) || isStrictChild(left, right) || isStrictChild(right, left)) {
    throw new Error('Vault and Bash temporary roots must not overlap');
  }
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

function assertPlainDirectory(directory: string, parent?: string): string {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Bash temporary path is not a plain directory: ${directory}`);
  }
  const resolved = fs.realpathSync.native(directory);
  if (!samePath(directory, resolved)) {
    throw new Error(`Bash temporary path resolves through a reparse point: ${directory}`);
  }
  if (parent && !isDirectChild(parent, resolved)) {
    throw new Error(`Bash temporary path escaped its parent: ${directory}`);
  }
  return resolved;
}

function ensurePlainDirectory(directory: string, parent?: string): string {
  try {
    fs.mkdirSync(directory, { recursive: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  return assertPlainDirectory(directory, parent);
}

function removePlainTree(directory: string, parent: string): void {
  const resolved = assertPlainDirectory(directory, parent);
  for (const name of fs.readdirSync(resolved)) {
    const child = path.join(resolved, name);
    const stat = fs.lstatSync(child);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(child);
    } else if (stat.isDirectory()) {
      removePlainTree(child, resolved);
    } else {
      fs.unlinkSync(child);
    }
  }
  fs.rmdirSync(resolved);
}

function vaultScope(vaultRoot: string): string {
  return crypto.createHash('sha256').update('obsidian-agent-bash-vault\0').update(vaultRoot).digest('hex');
}

function assertConversationId(conversationId: string): void {
  if (!CONVERSATION_ID.test(conversationId)) {
    throw new Error('Bash sandbox requires a canonical persistent conversation ID');
  }
}

/**
 * Owns Windows-only, conversation-scoped DSH temp grants. The manager is the
 * sole DACL owner; individual AclSandbox instances always use manageDacls:false.
 */
export class BashSessionTempManager {
  private static instance: BashSessionTempManager | undefined;
  private scope: Scope | undefined;
  private readonly entries = new Map<string, SessionEntry>();
  private readonly retiredConversationIds = new Set<string>();
  private workspaceGrant: AclWriteGrant | undefined;
  private acceptingAcquires = true;
  private abandoned = false;

  static getInstance(): BashSessionTempManager {
    if (!BashSessionTempManager.instance) BashSessionTempManager.instance = new BashSessionTempManager();
    return BashSessionTempManager.instance;
  }

  static resetInstance(): void {
    BashSessionTempManager.instance = undefined;
  }

  private configure(vaultPath: string): Scope {
    const vaultRoot = fs.realpathSync.native(vaultPath);
    if (!path.isAbsolute(vaultRoot)) throw new Error('Canonical Vault path is not absolute');
    assertPlainDirectory(vaultRoot);
    const tempRoot = fs.realpathSync.native(os.tmpdir());
    if (!path.isAbsolute(tempRoot)) throw new Error('Canonical OS temporary root is not absolute');
    assertPlainDirectory(tempRoot);
    assertDisjoint(vaultRoot, tempRoot);

    const pluginRoot = ensurePlainDirectory(path.join(tempRoot, 'obsidian-agent'), tempRoot);
    const bashRoot = ensurePlainDirectory(path.join(pluginRoot, 'bash'), pluginRoot);
    const scopeRoot = ensurePlainDirectory(path.join(bashRoot, vaultScope(vaultRoot)), bashRoot);
    return { vaultRoot, tempRoot, scopeRoot };
  }

  private ensureScope(vaultPath: string): Scope {
    const configured = this.configure(vaultPath);
    if (this.scope && (!samePath(this.scope.vaultRoot, configured.vaultRoot) || !samePath(this.scope.scopeRoot, configured.scopeRoot))) {
      throw new Error('Bash temporary manager cannot change Vault scope while active');
    }
    this.scope = configured;
    return configured;
  }

  async startup(vaultPath: string, validConversationIds: Iterable<string>): Promise<void> {
    if (process.platform !== 'win32') return;
    const scope = this.ensureScope(vaultPath);
    const valid = new Set([...validConversationIds].filter((id) => CONVERSATION_ID.test(id)));
    for (const name of fs.readdirSync(scope.scopeRoot)) {
      const child = path.join(scope.scopeRoot, name);
      if (valid.has(name)) continue;
      try {
        const stat = fs.lstatSync(child);
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
          fs.rmSync(child, { recursive: false, force: false });
          continue;
        }
        await this.revokeAndRemoveOrphan(child, scope.scopeRoot);
      } catch (error) {
        console.error('Failed to clean orphaned Bash temporary directory', child, error);
      }
    }
  }

  private async revokeAndRemoveOrphan(tempDir: string, parent: string): Promise<void> {
    const resolved = assertPlainDirectory(tempDir, parent);
    prepareEmbeddedKoffi();
    const grant = AclWriteGrant.create(tempWriteSid(resolved));
    try {
      grant.add(resolved);
      grant.dispose();
    } catch (error) {
      try { grant.dispose(); } catch (disposeError) { console.error('Failed to revoke orphaned Bash temp grant', disposeError); }
      throw error;
    }
    removePlainTree(resolved, parent);
  }

  private async ensureWorkspaceGrant(scope: Scope): Promise<void> {
    if (this.workspaceGrant) return;
    prepareEmbeddedKoffi();
    const grant = AclWriteGrant.create(workspaceWriteSid(scope.vaultRoot));
    try {
      grant.add(scope.vaultRoot, true);
      this.workspaceGrant = grant;
    } catch (error) {
      try { grant.dispose(); } catch (disposeError) { console.error('Failed to release incomplete Bash workspace grant', disposeError); }
      throw error;
    }
  }

  private newEntry(scope: Scope, conversationId: string): SessionEntry {
    const tempDir = path.join(scope.scopeRoot, conversationId);
    if (!isDirectChild(scope.scopeRoot, tempDir)) throw new Error('Bash temporary directory escaped its Vault scope');
    return { conversationId, tempDir, tempSid: tempWriteSid(tempDir), activeCount: 0, retiring: false };
  }

  private async ensureEntry(entry: SessionEntry, scope: Scope): Promise<void> {
    if (entry.grant) {
      try {
        assertPlainDirectory(entry.tempDir, scope.scopeRoot);
        return;
      } catch (error) {
        if (!isMissing(error) || entry.activeCount > 0) throw error;
        try { entry.grant.dispose(); } catch (disposeError) { throw new Error(`Failed to dispose a missing Bash temporary grant: ${String(disposeError)}`); }
        entry.grant = undefined;
      }
    }
    if (!entry.initPromise) {
      entry.initPromise = Promise.resolve().then(() => {
        const tempDir = ensurePlainDirectory(entry.tempDir, scope.scopeRoot);
        const tempSid = tempWriteSid(tempDir);
        prepareEmbeddedKoffi();
        const grant = AclWriteGrant.create(tempSid);
        try {
          grant.add(tempDir);
          entry.tempDir = tempDir;
          entry.tempSid = tempSid;
          entry.grant = grant;
        } catch (error) {
          try { grant.dispose(); } catch (disposeError) { console.error('Failed to release incomplete Bash temporary grant', disposeError); }
          throw error;
        }
      }).finally(() => { entry.initPromise = undefined; });
    }
    await entry.initPromise;
  }

  async acquire(vaultPath: string, conversationId: string, mode: 'read-only' | 'workspace-write'): Promise<BashSessionTempLease> {
    if (process.platform !== 'win32') throw new Error('Bash session temporary directories are Windows-only');
    assertConversationId(conversationId);
    if (!this.acceptingAcquires || this.abandoned) throw new Error('Bash sandbox is shutting down');
    const scope = this.ensureScope(vaultPath);
    if (this.retiredConversationIds.has(conversationId)) throw new Error('Bash temporary directory belongs to a deleted conversation');
    if (mode === 'workspace-write') await this.ensureWorkspaceGrant(scope);
    let entry = this.entries.get(conversationId);
    if (!entry) {
      entry = this.newEntry(scope, conversationId);
      this.entries.set(conversationId, entry);
    }
    if (entry.retiring) throw new Error('Bash temporary directory is retiring');
    await this.ensureEntry(entry, scope);
    if (!this.acceptingAcquires || entry.retiring || this.abandoned) throw new Error('Bash sandbox is shutting down');
    entry.activeCount += 1;
    let released = false;
    return {
      tempDir: entry.tempDir,
      tempWriteSid: entry.tempSid,
      // Keep the existing pseudo-read-only token mapping: this SID has no ACE.
      writeSid: mode === 'workspace-write' ? workspaceWriteSid(scope.vaultRoot) : workspaceWriteSid(entry.tempDir),
      release: async () => {
        if (released) return;
        released = true;
        entry!.activeCount -= 1;
        if (entry!.activeCount < 0) throw new Error('Bash temporary lease count underflow');
        if (entry!.retiring && entry!.activeCount === 0 && !this.abandoned) await this.cleanupEntry(entry!, scope);
      },
    };
  }

  async retire(conversationId: string): Promise<void> {
    if (process.platform !== 'win32' || !CONVERSATION_ID.test(conversationId)) return;
    this.retiredConversationIds.add(conversationId);
    const scope = this.scope;
    if (!scope) return;
    let entry = this.entries.get(conversationId);
    if (!entry) {
      entry = this.newEntry(scope, conversationId);
      this.entries.set(conversationId, entry);
    }
    entry.retiring = true;
    if (entry.activeCount === 0 && !this.abandoned) await this.cleanupEntry(entry, scope);
  }

  private async cleanupEntry(entry: SessionEntry, scope: Scope): Promise<void> {
    if (entry.cleanupPromise) return entry.cleanupPromise;
    entry.cleanupPromise = Promise.resolve().then(() => {
      if (entry.activeCount !== 0 || this.abandoned) return;
      let exists = true;
      try { assertPlainDirectory(entry.tempDir, scope.scopeRoot); } catch (error) {
        if (!isMissing(error)) throw error;
        exists = false;
      }
      if (entry.grant) {
        entry.grant.dispose();
        entry.grant = undefined;
      } else if (exists) {
        // A Reload may delete a session before this process has rebuilt its grant.
        const grant = AclWriteGrant.create(tempWriteSid(entry.tempDir));
        try {
          grant.add(entry.tempDir);
          grant.dispose();
        } catch (error) {
          try { grant.dispose(); } catch (disposeError) { console.error('Failed to release retired Bash temp grant', disposeError); }
          throw error;
        }
      }
      if (exists) removePlainTree(entry.tempDir, scope.scopeRoot);
      this.entries.delete(entry.conversationId);
    }).catch((error) => {
      console.error('Failed to clean Bash temporary directory', entry.tempDir, error);
    }).finally(() => { entry.cleanupPromise = undefined; });
    return entry.cleanupPromise;
  }

  beginShutdown(): void {
    this.acceptingAcquires = false;
  }

  async shutdown(): Promise<void> {
    if (process.platform !== 'win32') return;
    this.beginShutdown();
    const active = () => [...this.entries.values()].some((entry) => entry.activeCount > 0);
    const deadline = Date.now() + SHUTDOWN_DRAIN_MS;
    while (active() && Date.now() < deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
    if (active()) {
      this.abandoned = true;
      return;
    }
    for (const entry of this.entries.values()) {
      try {
        entry.grant?.dispose();
        entry.grant = undefined;
      } catch (error) {
        console.error('Failed to release Bash temporary grant during shutdown', entry.tempDir, error);
      }
    }
    try {
      this.workspaceGrant?.dispose();
      this.workspaceGrant = undefined;
    } catch (error) {
      console.error('Failed to release Bash workspace grant during shutdown', error);
    }
  }
}
