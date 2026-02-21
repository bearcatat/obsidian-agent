import { EditorView } from '@codemirror/view';

export class InputEditorState {
  private static instance: InputEditorState;
  private editorView: EditorView | null = null;

  private constructor() {}

  static getInstance(): InputEditorState {
    if (!InputEditorState.instance) {
      InputEditorState.instance = new InputEditorState();
    }
    return InputEditorState.instance;
  }

  static resetInstance(): void {
    InputEditorState.instance = undefined as any;
  }

  setEditorView(view: EditorView | null): void {
    this.editorView = view;
  }

  getEditorView(): EditorView | null {
    return this.editorView;
  }

  insertText(text: string): boolean {
    if (!this.editorView) return false;

    const view = this.editorView;
    const cursorPos = view.state.selection.main.head;

    view.dispatch({
      changes: { from: cursorPos, to: cursorPos, insert: text },
      selection: { anchor: cursorPos + text.length, head: cursorPos + text.length }
    });
    view.focus();
    return true;
  }
}
