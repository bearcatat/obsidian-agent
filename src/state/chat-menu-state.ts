import { TFolder, TFile, App } from 'obsidian';
import { getGlobalApp } from '@/utils';
import { ContextLogic } from '@/logic/context-logic';
import { InputEditorState } from './input-editor-state';

export class ChatMenuManager {
  private static instance: ChatMenuManager;
  private registered: boolean = false;

  private constructor() {}

  static getInstance(): ChatMenuManager {
    if (!ChatMenuManager.instance) {
      ChatMenuManager.instance = new ChatMenuManager();
    }
    return ChatMenuManager.instance;
  }

  static resetInstance(): void {
    ChatMenuManager.instance = undefined as any;
  }

  registerEvents(plugin: any): void {
    if (this.registered) return;
    this.registered = true;

    const app = getGlobalApp();

    plugin.registerEvent(
      app.workspace.on('file-menu', (menu: any, file: any) => {
        menu.addItem((item: any) => {
          item
            .setTitle('Add to Chat')
            .setIcon('message-square')
            .onClick(() => {
              const editorState = InputEditorState.getInstance();
              if (file instanceof TFolder) {
                editorState.insertText(`@{dir:${file.path}}`);
              } else if (file instanceof TFile) {
                editorState.insertText(`[[${file.path}|${file.basename}]]`);
              }
            });
        });
      })
    );

    plugin.registerEvent(
      app.workspace.on('editor-menu', (menu: any, editor: any, info: any) => {
        if (!editor.somethingSelected()) return;

        menu.addItem((item: any) => {
          item
            .setTitle('Add to Chat')
            .setIcon('message-square')
            .onClick(() => {
              const activeFile = info.file || app.workspace.getActiveFile();
              if (!activeFile) return;

              const selectionRange = ContextLogic.getInstance().getSelectionRange(editor);
              if (!selectionRange) return;

              const text = `[[${activeFile.path}|${activeFile.basename}:${selectionRange.from.line}-${selectionRange.to.line}]]`;
              InputEditorState.getInstance().insertText(text);
            });
        });
      })
    );
  }
}
