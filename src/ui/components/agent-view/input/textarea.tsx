import React, { useRef, useEffect, useState } from 'react';
import { cn } from '../../../elements/utils';
import { TFile } from 'obsidian';
import { useApp } from '../../../../hooks/app-context';

interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onDropFiles?: (files: TFile[]) => void;
}

export const Textarea: React.FC<TextareaProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled = false,
  className,
  onDropFiles
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const app = useApp();

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有当拖拽离开 textarea 元素本身时才取消状态
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!app || !onDropFiles) return;

    const dataTransfer = e.dataTransfer;
    const files: TFile[] = [];
    const processedPaths = new Set<string>();

    // 辅助函数：解析 obsidian:// URL 获取文件路径
    // 辅助函数：检查文件路径是否有扩展名
    const hasExtension = (filePath: string): boolean => {
      const lastDotIndex = filePath.lastIndexOf('.');
      const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
      // 有扩展名：点号存在且在最后一个斜杠之后
      return lastDotIndex > lastSlashIndex;
    };

    // 辅助函数：解析 obsidian:// URL 获取文件路径
    const parseObsidianUrl = (url: string): string | null => {
      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'obsidian:') return null;
        
        const fileParam = urlObj.searchParams.get('file');
        if (!fileParam) return null;
        
        // URL 解码文件路径
        let filePath = decodeURIComponent(fileParam);
        
        // 如果没有扩展名，添加 .md 扩展名
        if (!hasExtension(filePath)) {
          filePath += '.md';
        }
        
        return filePath;
      } catch (error) {
        return null;
      }
    };

    // 辅助函数：尝试将 URL 转换为 TFile
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
    const plainData = dataTransfer.getData('text/plain');
    // 首先尝试按换行分割（标准 text/uri-list 格式）
    const lines = plainData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    lines.forEach(tryAddFile)

    // 如果找到了文件，调用回调
    if (files.length > 0) {
      onDropFiles(files);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleInput}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "tw-w-full tw-min-h-[40px] tw-max-h-[120px] tw-resize-none tw-bg-transparent",
        "tw-border-none tw-outline-none tw-text-normal tw-text-sm",
        "tw-placeholder-text-muted tw-leading-relaxed",
        "focus:tw-ring-0 focus:tw-outline-none",
        isDragging && "tw-border tw-border-solid tw-border-blue-500 tw-bg-blue-50 dark:tw-bg-blue-900/20",
        className
      )}
    />
  );
};
