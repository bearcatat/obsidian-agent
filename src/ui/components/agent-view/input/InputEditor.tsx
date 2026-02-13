import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { minimalSetup } from 'codemirror';
import { TFile } from 'obsidian';
import { useApp } from '../../../../hooks/app-context';
import { cn } from '../../../elements/utils';

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 240;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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

const createEditorTheme = () => EditorView.theme({
  '&': {
    minHeight: `${MIN_HEIGHT}px`,
    maxHeight: `${MAX_HEIGHT}px`,
    fontSize: '0.875rem',
    lineHeight: '1.625',
    fontFamily: 'inherit'
  },
  '.cm-content': {
    padding: '8px 0',
    minHeight: `${MIN_HEIGHT - 16}px`,
    caretColor: 'var(--text-normal)'
  },
  '.cm-line': {
    padding: '0 4px'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-placeholder': {
    color: 'var(--text-muted)'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--text-normal)'
  }
});

const getClassNames = (isDragging: boolean, className?: string) => cn(
  "tw-w-full tw-min-h-[80px] tw-max-h-[240px] tw-bg-transparent",
  "tw-border-none tw-outline-none tw-text-normal tw-text-sm",
  "tw-placeholder-text-muted tw-leading-relaxed",
  "focus:tw-ring-0 focus:tw-outline-none",
  isDragging && "tw-border tw-border-solid tw-border-blue-500 tw-bg-blue-50 dark:tw-bg-blue-900/20",
  className
);

export const InputEditor = forwardRef<InputEditorRef, InputEditorProps>(({
  value, onChange, onKeyDown, placeholder, disabled = false, className, onPasteImages
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const editableCompartmentRef = useRef<Compartment | null>(null);
  const placeholderCompartmentRef = useRef<Compartment | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const app = useApp();

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
    blur: () => viewRef.current?.contentDOM.blur(),
    getEditorView: () => viewRef.current
  }));

  const adjustHeight = () => {
    const view = viewRef.current;
    if (!view) return;

    const scrollDOM = view.scrollDOM;
    scrollDOM.style.height = 'auto';
    const newHeight = Math.min(Math.max(scrollDOM.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    scrollDOM.style.height = `${newHeight}px`;
  };

  const processDrop = (dataTransfer: DataTransfer | null) => {
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

  useEffect(() => {
    if (!containerRef.current) return;

    const editableCompartment = new Compartment();
    const placeholderCompartment = new Compartment();
    editableCompartmentRef.current = editableCompartment;
    placeholderCompartmentRef.current = placeholderCompartment;

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          minimalSetup,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
              adjustHeight();
            }
          }),
          keymap.of([
            { key: 'Enter', run: () => false },
            { key: 'Shift-Enter', run: () => false }
          ]),
          createEditorTheme(),
          editableCompartment.of(EditorView.editable.of(!disabled)),
          placeholderCompartment.of(placeholder ? cmPlaceholder(placeholder) : [])
        ]
      }),
      parent: containerRef.current
    });

    viewRef.current = view;
    adjustHeight();

    return () => {
      view.destroy();
      viewRef.current = null;
      editableCompartmentRef.current = null;
      placeholderCompartmentRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (value !== currentValue) {
      view.dispatch({ changes: { from: 0, to: currentValue.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    const compartment = editableCompartmentRef.current;
    if (!view || !compartment) return;
    view.dispatch({ effects: compartment.reconfigure(EditorView.editable.of(!disabled)) });
  }, [disabled]);

  useEffect(() => {
    const view = viewRef.current;
    const compartment = placeholderCompartmentRef.current;
    if (!view || !compartment) return;
    view.dispatch({ effects: compartment.reconfigure(placeholder ? cmPlaceholder(placeholder) : []) });
  }, [placeholder]);

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
  }, [app]);

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
      className={getClassNames(isDragging, className)}
    />
  );
});

InputEditor.displayName = 'InputEditor';
