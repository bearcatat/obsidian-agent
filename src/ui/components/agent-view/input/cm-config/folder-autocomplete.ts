import { CompletionContext, CompletionSource, CompletionResult, Completion } from '@codemirror/autocomplete';
import { App, TFolder, prepareFuzzySearch } from 'obsidian';

const FOLDER_REF_PATTERN = /@([^\s{}]*)$/;
const FOLDER_ICON_PATH = 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z';

type FolderCompletion = Completion & {
  folderCompletion: true;
};

const collectFolders = (folder: TFolder): TFolder[] => {
  const folders: TFolder[] = [];

  for (const child of folder.children) {
    if (!(child instanceof TFolder)) continue;
    folders.push(child);
    folders.push(...collectFolders(child));
  }

  return folders;
};

const isFolderCompletion = (completion: Completion): completion is FolderCompletion => {
  return (completion as FolderCompletion).folderCompletion === true;
};

export const getFolderCompletionOptionClass = (completion: Completion): string => {
  return isFolderCompletion(completion) ? 'cm-folderCompletionOption' : '';
};

export const renderFolderCompletionIcon = (completion: Completion): Node | null => {
  if (!isFolderCompletion(completion)) return null;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const wrapper = document.createElement('span');
  wrapper.className = 'cm-folderCompletionIcon';
  wrapper.setAttribute('aria-hidden', 'true');

  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const path = document.createElementNS(svgNamespace, 'path');
  path.setAttribute('d', FOLDER_ICON_PATH);

  svg.appendChild(path);
  wrapper.appendChild(svg);

  return wrapper;
};

/**
 * Create a completion source for folder references.
 * Triggers on @ and inserts @{dir:path} tokens consumed by the existing folder ref widget.
 */
export const createFolderCompletionSource = (app: App): CompletionSource => {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(FOLDER_REF_PATTERN);

    if (!match) return null;

    const query = match.text.slice(1) || '';
    const from = match.from + 1;

    const folders = collectFolders(app.vault.getRoot());
    const searchFn = query ? prepareFuzzySearch(query) : null;
    const matches = folders.filter((folder) => {
      if (!searchFn) return true;
      return !!searchFn(folder.path) || !!searchFn(folder.name);
    });

    matches.sort((a, b) => a.path.localeCompare(b.path));

    const options: FolderCompletion[] = matches.slice(0, 20).map((folder) => ({
      label: folder.path,
      folderCompletion: true,
      detail: folder.name,
      apply: (view, completion, fromPos, toPos) => {
        const insertText = `@{dir:${folder.path}}`;
        view.dispatch({
          changes: { from: fromPos - 1, to: toPos, insert: insertText }
        });
      }
    }));

    return {
      from,
      options,
      filter: false,
    };
  };
};
