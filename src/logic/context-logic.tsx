import { Context, CursorPosition } from "@/types";
import { getGlobalApp } from "@/utils";
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

  private getBackgroundContext(): Context {
    const app = getGlobalApp();
    const activeNote = app.workspace.getActiveFile();

    const editor = this.getEditor(app, activeNote);
    const cursorPosition = this.getCursorPosition(editor);

    return {
      activeNote,
      cursorPosition,
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
