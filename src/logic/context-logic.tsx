import { Context, CursorPosition } from "@/types";
import { getGlobalApp } from "@/utils";
import { EditHistoryManager } from "@/state/edit-history-state";
import { Editor, TFile } from "obsidian";

export class ContextLogic {
  private static instance: ContextLogic;

  private constructor() {}

  static getInstance(): ContextLogic {
    if (!ContextLogic.instance) {
      ContextLogic.instance = new ContextLogic();
    }
    return ContextLogic.instance;
  }

  static resetInstance(): void {
    ContextLogic.instance = undefined as any;
  }

  private getEditor(app: any, activeNote: TFile | null): Editor | undefined {
    // Priority 1: Get from activeEditor (when focus is on editor)
    let editor = app.workspace.activeEditor?.editor;

    // Priority 2: If activeEditor is empty, try to get from MarkdownView
    if (!editor && activeNote) {
      const leaves = app.workspace.getLeavesOfType('markdown');
      for (const leaf of leaves) {
        const view = leaf.view;
        if (view && view.file?.path === activeNote.path && view.editor) {
          editor = view.editor;
          break;
        }
      }
    }

    return editor;
  }

  private getCursorPosition(editor: Editor | undefined): CursorPosition | undefined {
    if (!editor) return undefined;
    const cursor = editor.getCursor();
    return { line: cursor.line + 1, column: cursor.ch + 1 };
  }

  public getSelectionRange(editor: Editor | undefined): { from: CursorPosition, to: CursorPosition } | undefined {
    if (!editor) return undefined;
    if (!editor.somethingSelected()) return undefined;

    const from = editor.getCursor("from");
    const to = editor.getCursor("to");

    return {
      from: { line: from.line + 1, column: from.ch + 1 },
      to: { line: to.line + 1, column: to.ch + 1 }
    };
  }

  private getRecentFiles(): TFile[] {
    const app = getGlobalApp();
    const lastOpenFiles = app.workspace.getLastOpenFiles();
    return lastOpenFiles
      .map((path: string) => app.vault.getAbstractFileByPath(path))
      .filter((file: TFile | null): file is TFile => file instanceof TFile);
  }

  private getRecentEditFiles(): TFile[] {
    return EditHistoryManager.getInstance().getRecentEditFiles(10);
  }

  private getBackgroundContext(): Context {
    const app = getGlobalApp();
    const activeFile = app.workspace.getActiveFile();

    const editor = this.getEditor(app, activeFile);
    const cursorPosition = this.getCursorPosition(editor);

    const recentFiles = this.getRecentFiles();
    const recentEdits = this.getRecentEditFiles();

    return {
      activeNote: activeFile ?? undefined,
      cursorPosition,
      recentFiles,
      recentEdits,
    };
  }

  public getContext(userContext: Context): Context {
    const backgroundContext = this.getBackgroundContext();
    return {
      ...backgroundContext,
      ...userContext,
    };
  }
}
