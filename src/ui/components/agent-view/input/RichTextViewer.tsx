import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { minimalSetup } from 'codemirror';
import { useApp } from '../../../../hooks/app-context';
import { cn } from '../../../elements/utils';
import { viewerTheme } from './cm-config/theme';
import { createWikiLinkPlugin } from './cm-config/wiki-link-plugin';
import { adjustHeight } from './cm-config/utils';

// ==================== Types ====================

interface RichTextViewerProps {
  content: string;
  className?: string;
}

export interface RichTextViewerRef {
  getEditorView: () => EditorView | null;
}

// ==================== Component ====================

export const RichTextViewer = forwardRef<RichTextViewerRef, RichTextViewerProps>(({
  content, className
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const app = useApp();

  useImperativeHandle(ref, () => ({
    getEditorView: () => viewRef.current
  }));

  // Initialize viewer
  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          minimalSetup,
          viewerTheme,
          createWikiLinkPlugin(app),
          EditorView.editable.of(false)
        ]
      }),
      parent: containerRef.current
    });

    viewRef.current = view;

    // Initial height adjustment
    setTimeout(() => adjustHeight(view.scrollDOM), 0);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Sync external content
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (content !== currentContent) {
      view.dispatch({ changes: { from: 0, to: currentContent.length, insert: content } });
      setTimeout(() => adjustHeight(view.scrollDOM), 0);
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={cn("tw-w-full tw-h-full", className)}
    />
  );
});

RichTextViewer.displayName = 'RichTextViewer';
