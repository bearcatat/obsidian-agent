import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { minimalSetup } from 'codemirror';
import { autocompletion, acceptCompletion, completionStatus, moveCompletionSelection, closeCompletion } from '@codemirror/autocomplete';
import { TFile, App } from 'obsidian';
import { useApp } from '../../../../hooks/app-context';
import { cn } from '../../../elements/utils';
import { editorTheme } from './cm-config/theme';
import { createWikiLinkPlugin } from './cm-config/wiki-link-plugin';
import { createWikiLinkCompletionSource } from './cm-config/wiki-link-autocomplete';
import { createMarkdownLinkPlugin } from './cm-config/markdown-link-plugin';
import { pasteHandlerPlugin } from './cm-config/paste-handler-plugin';
import { createFolderRefPlugin } from './cm-config/folder-ref-plugin';
import { createCommandCompletionSource } from './cm-config/command-autocomplete';
import { MAX_IMAGE_SIZE, adjustHeight } from './cm-config/utils';

// ==================== Types ====================

interface InputEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSend?: () => void;
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

// ==================== Constants ====================

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'];

// ==================== File Utilities ====================

/**
 * Check if a file path has an extension
 */
const hasExtension = (filePath: string): boolean => {
  const lastDotIndex = filePath.lastIndexOf('.');
  const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastDotIndex > lastSlashIndex;
};

/**
 * Parse an obsidian:// URL and return the file path
 * Returns null if the URL is not a valid obsidian URL
 */
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

/**
 * Check if a file path is an image based on its extension
 */
const isImageFile = (filePath: string): boolean => {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  return IMAGE_EXTENSIONS.includes(ext);
};

/**
 * Convert a File or Blob to base64 data URL
 */
const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Convert a TFile to base64 data URL using Obsidian's vault API
 */
const tFileToBase64 = async (file: TFile, app: App): Promise<string | null> => {
  try {
    const binary = await app.vault.readBinary(file);
    const blob = new Blob([binary]);
    if (blob.size > MAX_IMAGE_SIZE) {
      console.warn(`Image ${file.name} exceeds 5MB limit`);
      return null;
    }
    return await fileToBase64(blob);
  } catch (error) {
    console.error('Failed to read image file:', error);
    return null;
  }
};

// ==================== Keymap Factory ====================

/**
 * Create keymap configuration for chat input
 * This function is called on every onSend/disabled change to avoid closure issues
 */
function createKeymap(onSend?: () => void, disabled?: boolean) {
  return keymap.of([
    {
      key: "Enter",
      run: (view) => {
        if (view.composing) return false;
        if (completionStatus(view.state) === "active") {
          return acceptCompletion(view);
        }
        if (disabled) return true;
        if (view.state.doc.toString().trim() === "") return true;
        onSend?.();
        return true;
      }
    },
    {
      key: "Shift-Enter",
      run: () => false
    },
    {
      key: "Tab",
      run: (view) => {
        if (completionStatus(view.state) === "active") {
          return acceptCompletion(view);
        }
        return false;
      }
    },
    {
      key: "ArrowDown",
      run: moveCompletionSelection(true)
    },
    {
      key: "ArrowUp",
      run: moveCompletionSelection(false)
    },
    {
      key: "Escape",
      run: closeCompletion
    }
  ]);
}

// ==================== Component ====================

export const InputEditor = forwardRef<InputEditorRef, InputEditorProps>(({
  value, onChange, onSend, placeholder, disabled = false, className, onPasteImages
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentsRef = useRef<{
    editable: Compartment | null;
    placeholder: Compartment | null;
    keymap: Compartment | null;
  }>({ editable: null, placeholder: null, keymap: null });
  const [isDragging, setIsDragging] = useState(false);
  const app = useApp();

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
    blur: () => viewRef.current?.contentDOM.blur(),
    getEditorView: () => viewRef.current
  }));

  /**
   * Process obsidian drop events
   * Handles both image files (via onPasteImages callback) and regular files (as wiki links)
   */
  const processDrop = useCallback(async (dataTransfer: DataTransfer | null): Promise<boolean> => {
    if (!app || !dataTransfer) return false;

    const view = viewRef.current;
    if (!view) return false;

    const files: TFile[] = [];
    const imageFiles: TFile[] = [];
    const processedPaths = new Set<string>();

    const tryAddFile = (input: string) => {
      if (!input || processedPaths.has(input)) return;

      const filePath = parseObsidianUrl(input);
      if (!filePath || processedPaths.has(filePath)) return;

      const abstractFile = app.vault.getAbstractFileByPath(filePath);
      if (!(abstractFile instanceof TFile)) return;

      if (isImageFile(filePath)) {
        imageFiles.push(abstractFile);
      } else {
        files.push(abstractFile);
      }
      processedPaths.add(filePath);
      processedPaths.add(input);
    };

    dataTransfer.getData('text/plain')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .forEach(tryAddFile);

    // Handle image files - convert to base64 and call onPasteImages
    if (imageFiles.length > 0 && onPasteImages) {
      const base64Results = await Promise.all(
        imageFiles.map(file => tFileToBase64(file, app))
      );
      const images = base64Results.filter((base64): base64 is string => base64 !== null);
      if (images.length > 0) {
        onPasteImages(images);
      }
    }

    // Handle non-image files - insert wiki links
    if (files.length > 0) {
      const cursorPos = view.state.selection.main.head;
      const wikiLinks = files.map(file => `[[${file.path}|${file.basename}]]`).join(' ');

      view.dispatch({
        changes: { from: cursorPos, to: cursorPos, insert: wikiLinks },
        selection: { anchor: cursorPos + wikiLinks.length, head: cursorPos + wikiLinks.length }
      });
      view.focus();
    }

    return files.length > 0 || imageFiles.length > 0;
  }, [app, onPasteImages]);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const editableCompartment = new Compartment();
    const placeholderCompartment = new Compartment();
    const keymapCompartment = new Compartment();
    compartmentsRef.current = { editable: editableCompartment, placeholder: placeholderCompartment, keymap: keymapCompartment };

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          minimalSetup,
          editorTheme,
          createWikiLinkPlugin(app),
          createMarkdownLinkPlugin(),
          createFolderRefPlugin(),
          pasteHandlerPlugin(onPasteImages),
          ...(app ? [autocompletion({
            override: [createCommandCompletionSource(), createWikiLinkCompletionSource(app)],
            defaultKeymap: false,
            closeOnBlur: false,
          })] : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
              setTimeout(() => adjustHeight(update.view.scrollDOM, 80), 0);
            }
          }),
          Prec.high(keymapCompartment.of(createKeymap(onSend, disabled))),
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
      compartmentsRef.current = { editable: null, placeholder: null, keymap: null };
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

  // Dynamic reconfigure: keymap (fixes closure issues with onSend and disabled)
  useEffect(() => {
    const view = viewRef.current;
    const compartment = compartmentsRef.current.keymap;
    if (!view || !compartment) return;
    view.dispatch({ effects: compartment.reconfigure(createKeymap(onSend, disabled)) });
  }, [onSend, disabled]);

  // Handle obsidian drop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDropCapture = async (e: DragEvent) => {
      const plainData = e.dataTransfer?.getData('text/plain');
      if (!plainData?.startsWith('obsidian://')) return;

      e.preventDefault();
      e.stopPropagation();

      const success = await processDrop(e.dataTransfer);
      if (success) {
        setIsDragging(false);
      }
    };

    container.addEventListener('drop', handleDropCapture, true);
    return () => container.removeEventListener('drop', handleDropCapture, true);
  }, [processDrop]);

  const handleDragState = useCallback((e: React.DragEvent<HTMLDivElement>, dragging: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging && e.currentTarget !== e.target) return;
    setIsDragging(dragging);
  }, []);

  return (
    <div
      ref={containerRef}
      onDragOver={(e) => handleDragState(e, true)}
      onDragEnter={(e) => handleDragState(e, true)}
      onDragLeave={(e) => handleDragState(e, false)}
      onDrop={(e) => handleDragState(e, false)}
      className={cn(
        "tw-w-full tw-h-full",
        isDragging && "tw-border tw-border-solid tw-border-blue-500 tw-bg-blue-50 dark:tw-bg-blue-900/20",
        className
      )}
    />
  );
});

InputEditor.displayName = 'InputEditor';
