import { CompletionContext, CompletionSource, CompletionResult, Completion } from '@codemirror/autocomplete';
import { App, TFile, prepareFuzzySearch, SearchResult } from 'obsidian';

// Regex patterns for wiki link triggers
const WIKI_LINK_PATTERN = /\[\[([^\]]*)/;  // English [[
const CHINESE_WIKI_LINK_PATTERN = /\u3010\u3010([^\u3011]*)/;  // Chinese 【【

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

    // Determine if it's Chinese or English bracket
    const isChinese = chineseMatch !== null;
    
    // Extract query from match text (remove the "[[" or "【【" prefix)
    const query = match.text.slice(2) || '';
    const from = match.from + 2; // Position after [[ or 【【

    // Get all markdown files (filter out non-markdown files like images)
    const files = app.vault.getMarkdownFiles().filter(file => 
      file.extension === 'md'
    );
    
    // Use Obsidian's fuzzy search
    const searchFn = prepareFuzzySearch(query);
    
    // Score and filter files
    interface FileMatch {
      file: TFile;
      result: SearchResult;
    }
    
    const matches: FileMatch[] = [];
    for (const file of files) {
      const result = searchFn(file.basename);
      if (result) {
        matches.push({ file, result });
      }
    }
    
    // Sort by score (higher is better match), then by modification time (newer first) for ties
    matches.sort((a, b) => {
      const scoreDiff = b.result.score - a.result.score;
      if (scoreDiff !== 0) return scoreDiff;
      // When scores are equal, sort by modification time (newest first)
      return b.file.stat.mtime - a.file.stat.mtime;
    });
    
    // Limit results
    const limitedMatches = matches.slice(0, 20);
    
    // Create completions
    const options: Completion[] = limitedMatches.map(({ file }) => ({
      label: file.basename,
      type: 'link',
      detail: file.path,
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
      validFor: isChinese ? /^[^\u3011]*$/ : /^[^\]]*$/, // Continue completing until 】 or ] is typed
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
