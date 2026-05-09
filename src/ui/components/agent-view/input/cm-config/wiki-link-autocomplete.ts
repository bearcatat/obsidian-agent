import { CompletionContext, CompletionSource, CompletionResult, Completion } from '@codemirror/autocomplete';
import { App, TFile, prepareFuzzySearch } from 'obsidian';

// Regex patterns for wiki link triggers
const WIKI_LINK_PATTERN = /\[\[([^\]]*)/;  // English [[
const CHINESE_WIKI_LINK_PATTERN = /\u3010\u3010([^\u3011]*)/;  // Chinese 【【
const NOTE_ICON_PATHS = [
  'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
  'M14 2v4a2 2 0 0 0 2 2h4',
  'M10 9H8',
  'M16 13H8',
  'M16 17H8',
];

type NoteCompletion = Completion & {
  noteCompletion: true;
};

const isNoteCompletion = (completion: Completion): completion is NoteCompletion => {
  return (completion as NoteCompletion).noteCompletion === true;
};

export const getNoteCompletionOptionClass = (completion: Completion): string => {
  return isNoteCompletion(completion) ? 'cm-noteCompletionOption' : '';
};

export const renderNoteCompletionIcon = (completion: Completion): Node | null => {
  if (!isNoteCompletion(completion)) return null;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const wrapper = document.createElement('span');
  wrapper.className = 'cm-noteCompletionIcon';
  wrapper.setAttribute('aria-hidden', 'true');

  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  for (const iconPath of NOTE_ICON_PATHS) {
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', iconPath);
    svg.appendChild(path);
  }

  wrapper.appendChild(svg);
  return wrapper;
};

/**
 * Create a completion source for wiki link auto-completion
 * Triggers on [[ or 【【 and uses Obsidian's fuzzy search to match notes
 */
export const createWikiLinkCompletionSource = (app: App): CompletionSource => {
  return (context: CompletionContext): CompletionResult | null => {
    // Try to match English [[ or Chinese 【【
    const englishMatch = context.matchBefore(WIKI_LINK_PATTERN);
    const chineseMatch = context.matchBefore(CHINESE_WIKI_LINK_PATTERN);
    
    const match = englishMatch || chineseMatch;
    
    // Don't trigger if not after [[ or 【【
    if (!match) return null;
    
    // Don't trigger on explicit completion (Ctrl+Space) unless there's [[ or 【【
    if (context.explicit && !match) return null;

    // Extract query from match text (remove the "[[" or "【【" prefix)
    const query = match.text.slice(2) || '';
    const from = match.from + 2; // Position after [[ or 【【

    // Get all markdown files (filter out non-markdown files like images)
    const files = app.vault.getMarkdownFiles().filter(file => 
      file.extension === 'md'
    );
    
    // Match against both basename and vault-relative path, but always rank by mtime.
    const searchFn = query ? prepareFuzzySearch(query) : null;
    const matches = files.filter((file: TFile) => {
      if (!searchFn) return true;
      return !!searchFn(file.path) || !!searchFn(file.basename);
    });

    matches.sort((a, b) => {
      const mtimeDiff = b.stat.mtime - a.stat.mtime;
      if (mtimeDiff !== 0) return mtimeDiff;
      return a.path.localeCompare(b.path);
    });
    
    // Limit results
    const limitedMatches = matches.slice(0, 20);
    
    // Create completions
    const options: NoteCompletion[] = limitedMatches.map((file) => ({
      label: file.path,
      noteCompletion: true,
      detail: file.basename,
      apply: (view, completion, fromPos, toPos) => {
        // Insert the wiki link with proper format (always use English [[ for compatibility)
        const insertText = `[[${file.path}|${file.basename}]]`;
        view.dispatch({
          changes: { from: fromPos - 2, to: toPos, insert: insertText }
        });
      }
    }));

    return {
      from,
      options,
      // Keep the mtime ordering we computed above instead of CodeMirror re-ranking by label.
      filter: false,
    };
  };
};

/**
 * Key handler for Tab to accept first completion
 */
export const acceptFirstCompletion = (event: KeyboardEvent, view: any): boolean => {
  // Check if Tab was pressed
  if (event.key !== 'Tab') return false;
  
  // Check if there's an active completion
  const completionState = view.state.field((view.state as any).facet?.completionState || {} as any, false);
  if (!completionState || !completionState.open) return false;
  
  event.preventDefault();
  
  // Accept the first (selected) completion
  const { startCompletion, acceptCompletion } = require('@codemirror/autocomplete');
  acceptCompletion(view);
  
  return true;
};
