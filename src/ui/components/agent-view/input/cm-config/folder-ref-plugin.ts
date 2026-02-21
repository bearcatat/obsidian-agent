import { EditorView, Decoration, WidgetType, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { Range } from '@codemirror/state';

export const folderRefRegex = /@\{dir:([^}]+)\}/g;

export const parseFolderRef = (ref: string): string => {
  const match = ref.match(/@\{dir:([^}]+)\}/);
  return match ? match[1] : '';
};

export class FolderRefWidget extends WidgetType {
  constructor(private folderPath: string) {
    super();
  }

  eq(other: FolderRefWidget): boolean {
    return other.folderPath === this.folderPath;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'tw-inline-flex tw-items-center tw-gap-1 tw-px-2 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-medium tw-bg-[var(--interactive-accent)] tw-text-[var(--text-on-accent)] tw-cursor-default tw-mx-0.5';
    
    const folderName = this.folderPath.split('/').pop() || this.folderPath;
    span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>${folderName}`;
    
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

export const createFolderRefPlugin = () => ViewPlugin.fromClass(class {
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
    folderRefRegex.lastIndex = 0;

    while ((match = folderRefRegex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const folderPath = match[1];

      decorations.push(Decoration.replace({
        widget: new FolderRefWidget(folderPath),
        inclusive: false
      }).range(start, end));
    }
    return Decoration.set(decorations);
  }
}, {
  decorations: v => v.decorations,
  provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.decorations ?? Decoration.none)
});
