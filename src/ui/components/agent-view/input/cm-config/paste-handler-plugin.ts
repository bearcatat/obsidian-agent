import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { MAX_IMAGE_SIZE } from './utils';
import { CopyContextManager } from '@/state/copy-context-state';

const URL_REGEX = /^(https?:\/\/[^\s]+)$/i;

/**
 * 将 File 或 Blob 转换为 base64 data URL
 */
const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * 创建粘贴处理插件
 * 处理图片和 URL 的粘贴
 */
export const pasteHandlerPlugin = (onPasteImages?: (images: string[]) => void) => {
  return ViewPlugin.fromClass(class PasteHandlerPlugin {
    view: EditorView;
    onPasteImages?: (images: string[]) => void;

    constructor(view: EditorView) {
      this.view = view;
      this.onPasteImages = onPasteImages;
      // 使用 capture 阶段确保在 CodeMirror 默认处理之前执行
      view.dom.addEventListener('paste', this.handlePaste, true);
    }

    update(_update: ViewUpdate) {
      // 不需要处理
    }

    destroy() {
      this.view.dom.removeEventListener('paste', this.handlePaste, true);
    }

    private handlePaste = async (e: ClipboardEvent) => {
      // 优先处理复制上下文
      const context = CopyContextManager.parseContextFromDataTransfer(e.clipboardData);
      if (context) {
        e.preventDefault();
        e.stopImmediatePropagation();

        const formattedText = CopyContextManager.formatContext(context);
        const cursorPos = this.view.state.selection.main.head;

        this.view.dispatch({
          changes: { from: cursorPos, to: cursorPos, insert: formattedText },
          selection: { anchor: cursorPos + formattedText.length, head: cursorPos + formattedText.length }
        });
        this.view.focus();

        // 清除上下文数据（可选，根据需求可以在粘贴后清除）
        e.clipboardData?.clearData();
        return;
      }

      const items = e.clipboardData?.items;
      const plainText = e.clipboardData?.getData('text/plain');

      // 处理图片粘贴
      if (items && this.onPasteImages) {
        const images: string[] = [];

        for (const item of Array.from(items)) {
          if (!item.type.startsWith('image/')) continue;
          const file = item.getAsFile();
          if (!file) continue;
          if (file.size > MAX_IMAGE_SIZE) {
            console.warn(`Image ${file.name || 'pasted image'} exceeds 5MB limit`);
            continue;
          }

          try {
            const base64 = await fileToBase64(file);
            images.push(base64);
          } catch (error) {
            console.error('Failed to read pasted image:', error);
          }
        }

        if (images.length > 0) {
          e.preventDefault();
          this.onPasteImages(images);
          return;
        }
      }

      // 处理 URL 粘贴 - 将 URL 转换为 markdown 链接格式
      if (plainText) {
        const lines = plainText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const urlLines: string[] = [];
        const nonUrlLines: string[] = [];

        for (const line of lines) {
          if (URL_REGEX.test(line)) {
            urlLines.push(line);
          } else {
            nonUrlLines.push(line);
          }
        }

        // 如果有 URL 行，则处理它们
        if (urlLines.length > 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          
          const cursorPos = this.view.state.selection.main.head;
          const markdownLinks = urlLines.map(url => {
            try {
              const urlObj = new URL(url);
              const domain = urlObj.hostname.replace(/^www\./, '');
              return `[${domain}](${url})`;
            } catch {
              return `[${url}](${url})`;
            }
          }).join(' ');

          const insertText = nonUrlLines.length > 0
            ? `${nonUrlLines.join('\n')}\n${markdownLinks}`
            : markdownLinks;

          this.view.dispatch({
            changes: { from: cursorPos, to: cursorPos, insert: insertText },
            selection: { anchor: cursorPos + insertText.length, head: cursorPos + insertText.length }
          });
          this.view.focus();
        }
      }
    };
  });
};
