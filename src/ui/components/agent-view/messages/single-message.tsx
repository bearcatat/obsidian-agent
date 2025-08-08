import { cn } from "../../../elements/utils";
import { useEffect, useRef, useState } from "react";
import { Component, MarkdownRenderer } from "obsidian";
import { useApp } from "../../../../hooks/app-context";
import { Message } from "../../../../types";

interface SingleMessageProps {
  message: Message;
  style?: React.CSSProperties;
}

const UserMessage: React.FC<Message> = ({
  content,
}) => {
  return (
    <div className="tw-whitespace-pre-wrap tw-break-words tw-text-[calc(var(--font-text-size)_-_2px)] tw-font-normal">
      {content}
    </div>
  )
}

const AgentMessage: React.FC<{
  content: string;
}> = ({
  content,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const componentRef = useRef<Component | null>(null);
  const app = useApp();

  useEffect(() => {
    let isUnmounting = false;
    const cleanup = () => {
      isUnmounting = true;
      setTimeout(() => {
        if (componentRef.current) {
          componentRef.current.unload();
          componentRef.current = null;
        }
      }, 0);
    }
    if (!app) return cleanup;
    if (!contentRef.current) return cleanup;

    contentRef.current.innerHTML = "";
    if (!componentRef.current) {
      componentRef.current = new Component();
    }

    if (isUnmounting) return cleanup;

    MarkdownRenderer.render(
      app,
      content,
      contentRef.current,
      "",
      componentRef.current
    );
    return cleanup;
    // 如果这里出现bug，考虑app没有加进来的可能
  }, [content, componentRef])

  return (
    <div className="" ref={contentRef}>{content}</div>
  )
}

const ToolMessage: React.FC<Message> = ({
  call_tool_msg,
}) => {
  return (
    <div className="tw-whitespace-pre-wrap tw-break-words tw-text-[calc(var(--font-text-size)_-_2px)] tw-font-normal">
      🔧{call_tool_msg}
    </div>
  )
}

const ThinkingMessage: React.FC<Message> = ({
  content,
  isStreaming,
}) => {
  return (
    <details className="tw-group tw-mx-1 tw-flex tw-gap-1 tw-rounded-md tw-p-1 tw-border tw-border-solid tw-border-border" open={isStreaming}>
      <summary className="tw-cursor-pointer tw-text-muted tw-text-xs tw-mb-1 tw-select-none">💭 Thinking</summary>
      <div className="tw-text-muted tw-mt-1 tw-p-1 tw-rounded-sm tw-bg-primary">
        <AgentMessage content={content} />
      </div>
    </details>
  )
}

const ErrorMessage: React.FC<Message> = ({
  content,
}) => {
  return (
    <div className="tw-text-error">❌{content}</div>
  )
}

export const SingleMessage: React.FC<SingleMessageProps> = ({ message, style }) => {
  return (
    <div 
      className="tw-flex tw-w-full tw-flex-col"
      style={style}
    >
      <div
        className={cn(
          "tw-group tw-flex tw-rounded-md tw-flex-col tw-p-1",
          message.role === "user" && "tw-border tw-border-solid tw-border-border"
        )}
      >
        <div className="message-content">
          {message.role === "user" && <UserMessage {...message} />}
          {message.role === "assistant" && <AgentMessage {...message} />}
          {message.role === "tool" && <ToolMessage {...message} />}
          {message.role === "thinking" && <ThinkingMessage {...message} />}
          {message.role === "error" && <ErrorMessage {...message} />}
        </div>
      </div>
    </div>
  )
}