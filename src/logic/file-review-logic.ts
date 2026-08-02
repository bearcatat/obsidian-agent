import { MarkdownView, Notice, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import { agentStore } from "@/state/agent-state-impl";
import { FileReviewEntry } from "@/types";
import { hashReviewContent } from "./file-review-utils";
import { SnapshotLogic } from "./snapshot-logic";
import { getGlobalApp } from "@/utils";
import { fileMutex } from "@/tool/FileEdit/mutex";
import { SessionLogic } from "./session-logic";

interface PrepareReviewBaseResult {
  baselineContent: string;
  baselineSnapshotId: string;
  isNewFile: boolean;
}

interface RegisterAutoAppliedChangeInput extends PrepareReviewBaseResult {
  filePath: string;
  headContent: string;
  toolCallId: string;
  messageId: string;
  toolName: string;
  conversationId?: string;
}

function isMarkdownLeaf(leaf: WorkspaceLeaf): leaf is WorkspaceLeaf & { view: MarkdownView } {
  return leaf.view instanceof MarkdownView;
}

export class FileReviewLogic {
  private static instance: FileReviewLogic;

  static getInstance(): FileReviewLogic {
    if (!FileReviewLogic.instance) {
      FileReviewLogic.instance = new FileReviewLogic();
    }
    return FileReviewLogic.instance;
  }

  static resetInstance(): void {
    FileReviewLogic.instance = undefined as any;
  }

  getFileReview(filePath: string, conversationId?: string): FileReviewEntry | undefined {
    const normalizedPath = normalizePath(filePath);
    const store = agentStore.getState();
    const id = conversationId ?? store.activeConversationId;
    return (id ? store.conversations[id]?.fileReviews ?? [] : []).find((review) => review.filePath === normalizedPath);
  }

  getActiveFileReviews(conversationId?: string): FileReviewEntry[] {
    const store = agentStore.getState();
    const id = conversationId ?? store.activeConversationId;
    return (id ? store.conversations[id]?.fileReviews ?? [] : [])
      .filter((review) => review.hasActiveDiff)
      .slice()
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async prepareReviewBase(filePath: string, currentContent: string, isNewFile: boolean, conversationId?: string): Promise<PrepareReviewBaseResult> {
    const normalizedPath = normalizePath(filePath);
    const existing = this.getFileReview(normalizedPath, conversationId);

    if (existing && existing.hasActiveDiff && existing.status === "reviewing") {
      return {
        baselineContent: existing.baselineContent,
        baselineSnapshotId: existing.baselineSnapshotId,
        isNewFile: existing.isNewFile,
      };
    }

    return {
      baselineContent: currentContent,
      baselineSnapshotId: await SnapshotLogic.getInstance().createSnapshot(normalizedPath),
      isNewFile,
    };
  }

  registerAutoAppliedChange(input: RegisterAutoAppliedChangeInput): FileReviewEntry {
    const normalizedPath = normalizePath(input.filePath);
    const existing = this.getFileReview(normalizedPath, input.conversationId);
    const hasActiveDiff = input.headContent !== input.baselineContent;

    for (const [conversationId, conversation] of Object.entries(agentStore.getState().conversations)) {
      if (conversationId === input.conversationId) continue;
      const competing = conversation.fileReviews.find(review => review.filePath === normalizedPath && review.hasActiveDiff);
      if (competing && competing.status !== 'conflicted') {
        agentStore.getState().upsertFileReview({ ...competing, status: 'conflicted', updatedAt: Date.now() }, conversationId);
        const updated = agentStore.getState().conversations[conversationId];
        if (updated) SessionLogic.getInstance().saveSession(updated);
      }
    }

    const entry: FileReviewEntry = {
      filePath: normalizedPath,
      baselineContent: input.baselineContent,
      baselineSnapshotId: input.baselineSnapshotId,
      headContent: input.headContent,
      headHash: hashReviewContent(input.headContent),
      isNewFile: input.isNewFile,
      status: hasActiveDiff ? "reviewing" : "reviewed",
      hasActiveDiff,
      isReverted: false,
      blocks: [],
      toolCallIds: Array.from(new Set([...(existing?.toolCallIds ?? []), input.toolCallId].filter(Boolean))),
      messageIds: Array.from(new Set([...(existing?.messageIds ?? []), input.messageId].filter(Boolean))),
      toolNames: Array.from(new Set([...(existing?.toolNames ?? []), input.toolName].filter(Boolean))),
      updatedAt: Date.now(),
    };

    agentStore.getState().upsertFileReview(entry, input.conversationId);
    return entry;
  }

  async adoptCurrentAsHead(filePath: string, conversationId?: string): Promise<void> {
    const normalizedPath = normalizePath(filePath);
    const existing = this.getFileReview(normalizedPath, conversationId);
    if (!existing || !existing.hasActiveDiff) {
      return;
    }

    const currentContent = await this.readCurrentFileContent(normalizedPath);
    const hasActiveDiff = currentContent !== existing.baselineContent;

    agentStore.getState().upsertFileReview({
      ...existing,
      headContent: currentContent,
      headHash: hashReviewContent(currentContent),
      blocks: [],
      status: hasActiveDiff ? "reviewing" : "reviewed",
      hasActiveDiff,
      isReverted: !hasActiveDiff,
      updatedAt: Date.now(),
    }, conversationId);
  }

  applyFile(filePath: string, conversationId?: string): void {
    const existing = this.getFileReview(filePath, conversationId);
    if (!existing) {
      return;
    }

    agentStore.getState().upsertFileReview({
      ...existing,
      blocks: [],
      status: "reviewed",
      hasActiveDiff: false,
      updatedAt: Date.now(),
      isReverted: false,
    }, conversationId);
  }

  applyBlock(_filePath: string, _blockId: string): void {
    // Legacy method — no-op in derived-block mode
  }

  applyAll(conversationId?: string): void {
    for (const review of this.getActiveFileReviews(conversationId)) {
      if (review.status === "reviewing") {
        this.applyFile(review.filePath, conversationId);
      }
    }
  }

  flushPendingAsApplied(conversationId?: string): void {
    this.applyAll(conversationId);
  }

  async rejectFile(filePath: string, conversationId?: string): Promise<void> {
    const targetId = conversationId ?? agentStore.getState().activeConversationId ?? undefined;
    const review = this.getFileReview(filePath, targetId);
    if (!review || !review.hasActiveDiff) {
      return;
    }
    if (review.status === 'conflicted') {
      new Notice('Cannot reject this change because the file was modified by another conversation.', 4000);
      return;
    }

    const normalizedPath = normalizePath(filePath);
    const release = await fileMutex.acquire(normalizedPath);

    try {
      await SnapshotLogic.getInstance().restoreSnapshot(review.baselineSnapshotId, normalizedPath);
      // Read the actually-restored content from disk rather than review.baselineContent
      // because accept operations may have advanced baselineContent past the original.
      const restoredContent = await this.readCurrentFileContent(normalizedPath);
      agentStore.getState().upsertFileReview({
        ...review,
        headContent: restoredContent,
        headHash: hashReviewContent(restoredContent),
        baselineContent: restoredContent,
        status: "reviewed",
        hasActiveDiff: false,
        isReverted: true,
        blocks: [],
        updatedAt: Date.now(),
      }, targetId);
    } finally {
      release();
    }
  }

  async rejectBlock(_filePath: string, _blockId: string): Promise<void> {
    // Legacy method — no-op in derived-block mode
  }

  async applyDerivedBlock(filePath: string, derivedBlock: { baselineStart: number; baselineEnd: number; patchText: string }, conversationId?: string): Promise<void> {
    const targetId = conversationId ?? agentStore.getState().activeConversationId ?? undefined;
    const review = this.getFileReview(filePath, targetId);
    if (!review || !review.hasActiveDiff) {
      return;
    }

    // Apply the patch to baselineContent to advance the baseline forward.
    // headContent (the file on disk) stays unchanged; the diff will shrink naturally.
    const { diff_match_patch: Dmp } = await import("diff-match-patch");
    const dmpInst = new Dmp();
    const patches = dmpInst.patch_fromText(derivedBlock.patchText);
    const baselineNorm = review.baselineContent.replace(/\r/g, "");
    const [newBaselineContent] = dmpInst.patch_apply(patches, baselineNorm);

    const headNorm = review.headContent.replace(/\r/g, "");
    const hasActiveDiff = headNorm !== newBaselineContent;

    agentStore.getState().upsertFileReview({
      ...review,
      baselineContent: newBaselineContent,
      blocks: [],
      status: hasActiveDiff ? "reviewing" : "reviewed",
      hasActiveDiff,
      isReverted: false,
      updatedAt: Date.now(),
    }, targetId);
  }

  async rejectDerivedBlock(filePath: string, derivedBlock: { baselineStart: number; baselineEnd: number; patchText: string }, conversationId?: string): Promise<void> {
    const targetId = conversationId ?? agentStore.getState().activeConversationId ?? undefined;
    const review = this.getFileReview(filePath, targetId);
    if (!review || !review.hasActiveDiff) {
      return;
    }
    if (review.status === 'conflicted') {
      new Notice('Cannot reject this block because the file was modified by another conversation.', 4000);
      return;
    }

    const normalizedPath = normalizePath(filePath);
    const release = await fileMutex.acquire(normalizedPath);

    try {
      // Apply the patch in reverse to remove this block's change from headContent
      const { diff_match_patch: Dmp } = await import("diff-match-patch");
      const dmpInst = new Dmp();
      const patches = dmpInst.patch_fromText(derivedBlock.patchText);
      // Reverse each patch: swap delete (-1) and insert (+1)
      const reversedPatches = patches.map((p: any) => ({
        ...p,
        diffs: p.diffs.map(([op, text]: [number, string]) => [op === -1 ? 1 : op === 1 ? -1 : 0, text]),
        length1: p.length2,
        length2: p.length1,
      }));
      const baselineNorm = review.baselineContent.replace(/\r/g, "");
      const headNorm = review.headContent.replace(/\r/g, "");
      const [newHeadContent] = dmpInst.patch_apply(reversedPatches, headNorm);

      const hasActiveDiff = newHeadContent !== baselineNorm;
      await this.writeFileContent(normalizedPath, newHeadContent);
      agentStore.getState().upsertFileReview({
        ...review,
        headContent: newHeadContent,
        headHash: hashReviewContent(newHeadContent),
        blocks: [],
        status: hasActiveDiff ? "reviewing" : "reviewed",
        hasActiveDiff,
        isReverted: !hasActiveDiff,
        updatedAt: Date.now(),
      }, targetId);
    } finally {
      release();
    }
  }

  async rejectAll(conversationId?: string): Promise<void> {
    conversationId = conversationId ?? agentStore.getState().activeConversationId ?? undefined;
    for (const review of this.getActiveFileReviews(conversationId)) {
      if (review.status === "reviewing") {
        await this.rejectFile(review.filePath, conversationId);
      }
    }
  }

  async focusFile(filePath: string): Promise<void> {
    const app = getGlobalApp();
    const normalizedPath = normalizePath(filePath);
    const file = app.vault.getAbstractFileByPath(normalizedPath);
    if (!(file instanceof TFile)) {
      return;
    }

    const leaf = this.pickMarkdownLeaf(app.workspace.getLeavesOfType("markdown"), app.workspace.activeLeaf ?? undefined)
      ?? app.workspace.getMostRecentLeaf()
      ?? app.workspace.getLeaf(false);

    if (leaf.isDeferred) {
      await leaf.loadIfDeferred();
    }

    await leaf.openFile(file);
    await app.workspace.revealLeaf(leaf);

    if (isMarkdownLeaf(leaf)) {
      leaf.view.editor.cm?.focus();
    }
  }

  private pickMarkdownLeaf(leaves: WorkspaceLeaf[], activeLeaf?: WorkspaceLeaf): WorkspaceLeaf | null {
    if (activeLeaf && isMarkdownLeaf(activeLeaf)) {
      return activeLeaf;
    }

    const markdownLeaves = leaves.filter(isMarkdownLeaf);
    if (markdownLeaves.length === 0) {
      return null;
    }

    return markdownLeaves.find((leaf) => leaf.view.editor.cm)
      ?? markdownLeaves[0]
      ?? null;
  }

  private async readCurrentFileContent(filePath: string): Promise<string> {
    const app = getGlobalApp();
    const activeLeaf = app.workspace.activeLeaf;

    if (activeLeaf && isMarkdownLeaf(activeLeaf) && activeLeaf.view.file?.path === filePath) {
      return activeLeaf.view.editor.getValue();
    }

    for (const leaf of app.workspace.getLeavesOfType("markdown")) {
      if (!isMarkdownLeaf(leaf)) {
        continue;
      }

      if (leaf.view.file?.path === filePath) {
        return leaf.view.editor.getValue();
      }
    }

    const file = app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      return await app.vault.read(file);
    }

    return "";
  }

  private async writeFileContent(filePath: string, content: string): Promise<void> {
    const app = getGlobalApp();
    const vault = app.vault;
    const file = vault.getAbstractFileByPath(filePath);

    if (file instanceof TFile) {
      await vault.modify(file, content);
      return;
    }

    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
    if (dirPath && dirPath !== "." && !(await vault.adapter.exists(dirPath))) {
      await vault.adapter.mkdir(dirPath);
    }
    await vault.create(filePath, content);
  }
}
