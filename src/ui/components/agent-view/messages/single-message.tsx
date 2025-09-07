import { cn } from "../../../elements/utils";
import { useEffect, useRef, useCallback } from "react";
import { Component, MarkdownRenderer } from "obsidian";
import { useApp } from "../../../../hooks/app-context";
import { Message } from "../../../../types";
import { TFile } from "obsidian";

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

    // From https://github.com/logancyang/obsidian-copilot
    const preprocess = useCallback(
      (content: string): string => {
        if (!app) return content;
        const activeFile = app.workspace.getActiveFile();
        const sourcePath = activeFile ? activeFile.path : "";

        const replaceLinks = (text: string, regex: RegExp, template: (file: TFile) => string) => {
          // Split text into code blocks and non-code blocks
          const parts = text.split(/(```[\s\S]*?```|`[^`]*`)/g);

          return parts
            .map((part, index) => {
              // Even indices are normal text, odd indices are code blocks
              if (index % 2 === 0) {
                // Process links only in non-code blocks
                return part.replace(regex, (match: string, selection: string) => {
                  const file = app.metadataCache.getFirstLinkpathDest(selection, sourcePath);
                  return file ? template(file) : match;
                });
              }
              // Return code blocks unchanged
              return part;
            })
            .join("");
        };

        // Process LaTeX
        const latexProcessed = content
          .replace(/\\\[\s*/g, "$$")
          .replace(/\s*\\\]/g, "$$")
          .replace(/\\\(\s*/g, "$")
          .replace(/\s*\\\)/g, "$");

        // Process only Obsidian internal images (starting with ![[)
        const noteImageProcessed = replaceLinks(
          latexProcessed,
          /!\[\[(.*?)]]/g,
          (file) => `![](${app.vault.getResourcePath(file)})`
        );

        // Transform [[link]] to clickable format but exclude ![[]] image links
        const noteLinksProcessed = replaceLinks(
          noteImageProcessed,
          /(?<!!)\[\[([^\]]+)]]/g,
          (file: TFile) =>
            `<a href="obsidian://open?file=${encodeURIComponent(file.path)}" target="_blank">${file.basename}</a>`
        );

        return noteLinksProcessed;
      },
      [app]
    );

    useEffect(() => {
      if (!app || !contentRef.current) return;

      contentRef.current.innerHTML = "";
      if (!componentRef.current) {
        componentRef.current = new Component();
      }

      const processedContent = preprocess(content);

      MarkdownRenderer.render(
        app,
        processedContent,
        contentRef.current,
        "",
        componentRef.current
      );

      return () => {
        if (componentRef.current) {
          componentRef.current.unload();
          componentRef.current = null;
        }
      };
    }, [content, app, preprocess])

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