import { TFile, Editor, MarkdownView } from 'obsidian';
import { getGlobalApp } from '@/utils';
import { ContextLogic } from '@/logic/context-logic';

/**
 * 复制上下文数据接口
 */
export interface CopyContext {
  notePath: string;
  noteName: string;
  startLine: number;
  endLine: number;
  selectedText?: string;
}

/**
 * DataTransfer 中使用的 MIME 类型
 */
export const COPY_CONTEXT_MIME_TYPE = 'application/obsidian-agent-context';

/**
 * 复制上下文管理器
 * 单例模式，管理复制时的上下文信息
 */
export class CopyContextManager {
  private static instance: CopyContextManager;
  private lastContext: CopyContext | null = null;
  private registered: boolean = false;
  
  private constructor() {}

  static getInstance(): CopyContextManager {
    if (!CopyContextManager.instance) {
      CopyContextManager.instance = new CopyContextManager();
    }
    return CopyContextManager.instance;
  }

  static resetInstance(): void {
    CopyContextManager.instance = undefined as any;
  }

  /**
   * 注册复制事件监听
   * 需要在插件的 onload 中调用
   */
  registerEvents(plugin: any): void {
    if (this.registered) return;
    this.registered = true;
    
    plugin.registerDomEvent(document, 'copy', (e: ClipboardEvent) => {
      this.handleCopy(e);
    });
  }

  /**
   * 处理复制事件
   * 获取当前笔记和选区信息，存储到 DataTransfer
   */
  private handleCopy(e: ClipboardEvent): void {
    const app = getGlobalApp();
    const activeFile = app.workspace.getActiveFile();
    
    if (!activeFile) return;
    
    const editor = this.getActiveEditor();
    if (!editor) return;
    
    // 检查是否有选中的文本
    if (!editor.somethingSelected()) return;
    
    const selectionRange = ContextLogic.getInstance().getSelectionRange(editor);
    if (!selectionRange) return;
    
    const context: CopyContext = {
      notePath: activeFile.path,
      noteName: activeFile.basename,
      startLine: selectionRange.from.line,
      endLine: selectionRange.to.line,
      selectedText: editor.getSelection()
    };
    
    // 存储到 DataTransfer
    try {
      e.clipboardData?.setData(
        COPY_CONTEXT_MIME_TYPE,
        JSON.stringify(context)
      );
      this.lastContext = context;
    } catch (error) {
      console.error('Failed to set copy context:', error);
    }
  }

  /**
   * 获取当前激活的编辑器
   */
  private getActiveEditor(): Editor | null {
    const app = getGlobalApp();
    
    // Priority 1: Get from activeEditor
    let editor = app.workspace.activeEditor?.editor;
    if (editor) return editor;
    
    // Priority 2: Get from active markdown view
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) return null;
    
    const leaves = app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
      const view = leaf.view as MarkdownView;
      if (view && view.file?.path === activeFile.path && view.editor) {
        return view.editor;
      }
    }
    
    return null;
  }

  /**
   * 获取最后复制的上下文
   */
  public getLastContext(): CopyContext | null {
    return this.lastContext;
  }

  /**
   * 清空最后复制的上下文
   */
  public clearContext(): void {
    this.lastContext = null;
  }

  /**
   * 从 DataTransfer 解析上下文
   */
  public static parseContextFromDataTransfer(dataTransfer: DataTransfer | null): CopyContext | null {
    if (!dataTransfer) return null;
    
    const data = dataTransfer.getData(COPY_CONTEXT_MIME_TYPE);
    if (!data) return null;
    
    try {
      return JSON.parse(data) as CopyContext;
    } catch (error) {
      console.error('Failed to parse copy context:', error);
      return null;
    }
  }

  /**
   * 格式化上下文为 [[note.md|name:1-2]] 格式
   */
  public static formatContext(context: CopyContext): string {
    return `[[${context.notePath}|${context.noteName}:${context.startLine}-${context.endLine}]]`;
  }
}
