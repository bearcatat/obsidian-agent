import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { minimalSetup } from 'codemirror';
import { TFile } from 'obsidian';
import { useApp } from '../../../../hooks/app-context';
import { cn } from '../../../elements/utils';
import { editorTheme } from './cm-config/theme';
import { createWikiLinkPlugin } from './cm-config/wiki-link-plugin';
import { MAX_IMAGE_SIZE, adjustHeight } from './cm-config/utils';

// ==================== Types ====================

interface InputEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onPasteImages?: (images: string[]) => void;
}

export interface InputEditorRef {
  focus: () => void;
  blur: () => void;
  getEditorView: () => EditorView | null;
}

// ==================== Component ====================

export const InputEditor = forwardRef<InputEditorRef, InputEditorProps>(({
  value, onChange, onKeyDown, placeholder, disabled = false, className, onPasteImages
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentsRef = useRef<{
    editable: Compartment | null;
    placeholder: Compartment | null;
  }>({ editable: null, placeholder: null });
  const [isDragging, setIsDragging] = useState(false);
  const app = useApp();

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
    blur: () => viewRef.current?.contentDOM.blur(),
    getEditorView: () => viewRef.current
  }));

  // Process obsidian drop
  const processDrop = (dataTransfer: DataTransfer | null): boolean => {
    if (!app || !dataTransfer) return false;

    const view = viewRef.current;
    if (!view) return false;

    const files: TFile[] = [];
    const processedPaths = new Set<string>();

    const hasExtension = (filePath: string) => {
      const lastDotIndex = filePath.lastIndexOf('.');
      const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
      return lastDotIndex > lastSlashIndex;
    };

    const parseObsidianUrl = (url: string): string | null => {
      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'obsidian:') return null;
        const fileParam = urlObj.searchParams.get('file');
        if (!fileParam) return null;
        let filePath = decodeURIComponent(fileParam);
        if (!hasExtension(filePath)) filePath += '.md';
        return filePath;
      } catch {
        return null;
      }
    };

    const tryAddFile = (input: string) => {
      if (!input || processedPaths.has(input)) return;
      const filePath = parseObsidianUrl(input);
      if (!filePath || processedPaths.has(filePath)) return;
      const abstractFile = app.vault.getAbstractFileByPath(filePath);
      if (abstractFile instanceof TFile) {
        files.push(abstractFile);
        processedPaths.add(filePath);
        processedPaths.add(input);
      }
    };

    dataTransfer.getData('text/plain')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .forEach(tryAddFile);

    if (files.length === 0) return false;

    const cursorPos = view.state.selection.main.head;
    const wikiLinks = files.map(file => `[[${file.path}|${file.basename}]]`).join(' ');

    view.dispatch({
      changes: { from: cursorPos, to: cursorPos, insert: wikiLinks },
      selection: { anchor: cursorPos + wikiLinks.length, head: cursorPos + wikiLinks.length }
    });

    view.focus();
    return true;
  };

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const editableCompartment = new Compartment();
    const placeholderCompartment = new Compartment();
    compartmentsRef.current = { editable: editableCompartment, placeholder: placeholderCompartment };

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          minimalSetup,
          editorTheme,
          createWikiLinkPlugin(app),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
              setTimeout(() => adjustHeight(update.view.scrollDOM, 80), 0);
            }
          }),
          keymap.of([
            { key: 'Enter', run: () => false },
            { key: 'Shift-Enter', run: () => false }
          ]),
          editableCompartment.of(EditorView.editable.of(!disabled)),
          placeholderCompartment.of(placeholder ? cmPlaceholder(placeholder) : [])
        ]
      }),
      parent: containerRef.current
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      compartmentsRef.current = { editable: null, placeholder: null };
    };
  }, []);

  // Sync external value and adjust height
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (value !== currentValue) {
      view.dispatch({ changes: { from: 0, to: currentValue.length, insert: value } });
      setTimeout(() => adjustHeight(view.scrollDOM, 80), 0);
    }
  }, [value]);

  // Dynamic reconfigure: disabled
  useEffect(() => {
    const view = viewRef.current;
    const compartment = compartmentsRef.current.editable;
    if (!view || !compartment) return;
    view.dispatch({ effects: compartment.reconfigure(EditorView.editable.of(!disabled)) });
  }, [disabled]);

  // Dynamic reconfigure: placeholder
  useEffect(() => {
    const view = viewRef.current;
    const compartment = compartmentsRef.current.placeholder;
    if (!view || !compartment) return;
    view.dispatch({ effects: compartment.reconfigure(placeholder ? cmPlaceholder(placeholder) : []) });
  }, [placeholder]);

  // Handle paste images
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onPasteImages) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

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
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          images.push(base64);
        } catch (error) {
          console.error('Failed to read pasted image:', error);
        }
      }

      if (images.length > 0) {
        e.preventDefault();
        onPasteImages(images);
      }
    };

    container.addEventListener('paste', handlePaste);
    return () => container.removeEventListener('paste', handlePaste);
  }, [onPasteImages]);

  // Handle obsidian drop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDropCapture = (e: DragEvent) => {
      const plainData = e.dataTransfer?.getData('text/plain');
      if (!plainData?.startsWith('obsidian://')) return;

      e.preventDefault();
      e.stopPropagation();

      if (processDrop(e.dataTransfer)) {
        setIsDragging(false);
      }
    };

    container.addEventListener('drop', handleDropCapture, true);
    return () => container.removeEventListener('drop', handleDropCapture, true);
  }, [processDrop]);

  const setDragState = (e: React.DragEvent<HTMLDivElement>, dragging: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging && e.currentTarget !== e.target) return;
    setIsDragging(dragging);
  };

  return (
    <div
      ref={containerRef}
      onDragOver={(e) => setDragState(e, true)}
      onDragEnter={(e) => setDragState(e, true)}
      onDragLeave={(e) => setDragState(e, false)}
      onDrop={(e) => setDragState(e, false)}
      onKeyDown={onKeyDown}
      className={cn("tw-w-full tw-h-full", isDragging && "tw-border tw-border-solid tw-border-blue-500 tw-bg-blue-50 dark:tw-bg-blue-900/20", className)}
    />
  );
});

InputEditor.displayName = 'InputEditor';
