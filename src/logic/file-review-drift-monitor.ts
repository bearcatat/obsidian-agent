import { MarkdownFileInfo, MarkdownView, Plugin } from "obsidian";
import { FileReviewLogic } from "./file-review-logic";
import { hashReviewContent } from "./file-review-utils";

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

      const review = FileReviewLogic.getInstance().getFileReview(filePath);
      if (!review || !review.hasActiveDiff) {
        return;
      }

      if (Date.now() - review.updatedAt < 500) {
        return;
      }

      const currentHash = hashReviewContent(editor.getValue());
      if (currentHash !== review.headHash) {
        void FileReviewLogic.getInstance().adoptCurrentAsHead(filePath);
      }
    }));
  }
}