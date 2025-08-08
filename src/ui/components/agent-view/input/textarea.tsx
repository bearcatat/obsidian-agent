import React, { useRef, useEffect } from 'react';
import { cn } from '../../../elements/utils';

interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled = false,
  className
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      className={cn(
        "tw-w-full tw-min-h-[40px] tw-max-h-[120px] tw-resize-none tw-bg-transparent",
        "tw-border-none tw-outline-none tw-text-normal tw-text-sm",
        "tw-placeholder-text-muted tw-leading-relaxed",
        "focus:tw-ring-0 focus:tw-outline-none",
        className
      )}
    />
  );
};
