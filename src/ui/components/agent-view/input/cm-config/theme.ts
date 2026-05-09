import { EditorView } from '@codemirror/view';

const baseThemeSpec = {
  '.cm-editor': {
    height: '100%'
  },
  '.cm-content': {
    padding: '8px 0',
    caretColor: 'var(--text-normal)'
  },
  '.cm-line': {
    padding: '0 4px'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--text-normal)'
  },
  '.cm-scroller': {
    height: '100%',
    overflowY: 'auto',
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': {
      display: 'none'
    }
  },
  '.cm-folderCompletionIcon, .cm-noteCompletionIcon': {
    width: '1em',
    height: '1em',
    display: 'inline-block',
    verticalAlign: '-0.125em',
    paddingRight: '0.25em',
    opacity: '0.8',
    color: 'var(--text-muted)',
    boxSizing: 'content-box',
    '& svg': {
      width: '1em',
      height: '1em',
      display: 'block'
    }
  },
  '.cm-folderCompletionOption .cm-completionIcon, .cm-noteCompletionOption .cm-completionIcon': {
    display: 'none'
  }
};

export const editorTheme = EditorView.theme({
  '&': {
    minHeight: '80px',
    maxHeight: '240px',
    height: '100%',
    fontSize: '0.875rem',
    lineHeight: '1.625',
    fontFamily: 'inherit'
  },
  '.cm-placeholder': {
    color: 'var(--text-muted)'
  },
  ...baseThemeSpec
});

export const viewerTheme = EditorView.theme({
  '&': {
    maxHeight: '240px',
    height: '100%',
    fontSize: '0.875rem',
    lineHeight: '1.625',
    fontFamily: 'inherit'
  },
  ...baseThemeSpec
});
