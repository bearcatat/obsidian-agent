import { EditorView, Decoration, WidgetType, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { Range } from '@codemirror/state';

// 匹配 [text](url) 格式的 markdown 链接
export const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;

export class MarkdownLinkWidget extends WidgetType {
  constructor(
    private displayText: string,
    private url: string
  ) {
    super();
  }

  eq(other: MarkdownLinkWidget): boolean {
    return other.displayText === this.displayText && other.url === this.url;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'tw-inline-flex tw-items-center tw-gap-1 tw-px-2 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-medium tw-bg-[var(--interactive-accent)] tw-text-[var(--text-on-accent)] tw-cursor-pointer hover:tw-opacity-80 tw-transition-opacity tw-mx-0.5';
    
    // 添加 "url:" 前缀
    const prefix = document.createElement('span');
    prefix.className = 'tw-opacity-70';
    prefix.textContent = 'url:';
    span.appendChild(prefix);
    
    // 添加域名文本
    const text = document.createElement('span');
    text.textContent = this.displayText;
    span.appendChild(text);
    
    span.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(this.url, '_blank');
    });
    
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export const createMarkdownLinkPlugin = () => ViewPlugin.fromClass(class {
  decorations: any;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView) {
    const decorations: Range<Decoration>[] = [];
    const text = view.state.doc.toString();

    let match;
    markdownLinkRegex.lastIndex = 0;

    while ((match = markdownLinkRegex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const displayText = match[1];
      const url = match[2];

      decorations.push(Decoration.replace({
        widget: new MarkdownLinkWidget(displayText, url),
        inclusive: false
      }).range(start, end));
    }
    
    return Decoration.set(decorations);
  }
}, {
  decorations: v => v.decorations,
  provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.decorations ?? Decoration.none)
});
