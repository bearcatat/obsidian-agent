import { MarkdownFileInfo, MarkdownView, Plugin } from "obsidian";
import { hashReviewContent } from "./file-review-utils";
import { agentStore } from "@/state/agent-state-impl";
import { SessionLogic } from "./session-logic";

export class FileReviewDriftMonitor {
  private static instance: FileReviewDriftMonitor;

  static getInstance(): FileReviewDriftMonitor {
    if (!FileReviewDriftMonitor.instance) {
      FileReviewDriftMonitor.instance = new FileReviewDriftMonitor();
    }
    return FileReviewDriftMonitor.instance;
  }

  static resetInstance(): void {
    FileReviewDriftMonitor.instance = undefined as any;
  }

  register(plugin: Plugin): void {
    plugin.registerEvent(plugin.app.workspace.on("editor-change", (editor, info: MarkdownView | MarkdownFileInfo) => {
      const filePath = info.file?.path;
      if (!filePath) {
        return;
      }

      const currentHash = hashReviewContent(editor.getValue());
      const store = agentStore.getState();
      for (const [conversationId, conversation] of Object.entries(store.conversations)) {
        const review = conversation.fileReviews.find(item => item.filePath === filePath && item.hasActiveDiff);
        if (!review || Date.now() - review.updatedAt < 500 || currentHash === review.headHash) continue;
        store.upsertFileReview({ ...review, status: 'conflicted', updatedAt: Date.now() }, conversationId);
        const updated = agentStore.getState().conversations[conversationId];
        if (updated) SessionLogic.getInstance().saveSession(updated);
      }
    }));
  }
}
