import { EditorView, Decoration, WidgetType, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { Range } from '@codemirror/state';

export const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;

export const parseWikiLink = (link: string): { fileName: string; displayName: string } => {
  const content = link.slice(2, -2);
  const pipeIndex = content.indexOf('|');
  if (pipeIndex > 0) {
    return {
      fileName: content.slice(0, pipeIndex),
      displayName: content.slice(pipeIndex + 1)
    };
  }
  return {
    fileName: content,
    displayName: content.split('/').pop() || content
  };
};

export class WikiLinkWidget extends WidgetType {
  constructor(
    private linkText: string,
    private onOpen: () => void
  ) {
    super();
  }

  eq(other: WikiLinkWidget): boolean {
    return other.linkText === this.linkText;
  }

  toDOM(): HTMLElement {
    const { displayName } = parseWikiLink(this.linkText);
    const span = document.createElement('span');
    span.className = 'tw-inline-flex tw-items-center tw-px-2 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-medium tw-bg-[var(--interactive-accent)] tw-text-[var(--text-on-accent)] tw-cursor-pointer hover:tw-opacity-80 tw-transition-opacity tw-mx-0.5';
    span.textContent = displayName;
    span.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onOpen();
    });
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export const createWikiLinkPlugin = (app: any) => ViewPlugin.fromClass(class {
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
    wikiLinkRegex.lastIndex = 0;

    while ((match = wikiLinkRegex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const linkText = match[0];
      const { fileName } = parseWikiLink(linkText);

      decorations.push(Decoration.replace({
        widget: new WikiLinkWidget(linkText, () => {
          if (app) {
            app.workspace.openLinkText(fileName, '', false);
          }
        }),
        inclusive: false
      }).range(start, end));
    }
    return Decoration.set(decorations);
  }
}, {
  decorations: v => v.decorations,
  provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.decorations ?? Decoration.none)
});
