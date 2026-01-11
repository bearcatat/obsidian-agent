import { MessageCard } from "./message-card";
import { useRef, useCallback, useEffect } from "react";
import { Component, MarkdownRenderer, App, TFile} from "obsidian";
import { useApp } from "@/hooks/app-context";

type Props = {
    content: string;
}

export function AssistantMessageCard({ content }: Props) {
    const contentRef = useRef<HTMLDivElement>(null);
    const componentRef = useRef<Component | null>(null);
    const app = useApp();

    // 文本预处理
    const preprocess = useCallback((content: string) => {
        if (!app) return content;
        const preprocessor = new TextPreProcessor(app);
        return preprocessor.process(content);
    }, [app])

    // markdown渲染
    useEffect(() => {
        if (!app || !contentRef.current) return;

        contentRef.current.innerHTML = "";
        componentRef.current ??= new Component();

        const processedContent = preprocess(content);
        MarkdownRenderer.render(app, processedContent, contentRef.current, "", componentRef.current);

        return () => {
            componentRef.current?.unload();
            componentRef.current = null;
        }
    }, [app, content, preprocess]);

    return (
        <MessageCard>
            <div ref={contentRef}>{content}</div>
        </MessageCard>
    )
}

class TextPreProcessor {
    app: App;
    sourcePath: string;
    constructor(app: App) {
        this.app = app;
        this.sourcePath = app.workspace.getActiveFile()?.path || "";
    }
    process(content: string): string {
        return processText(content, [
            processLaTeX,
            (content) => this.processNoteImage(content),
            (content) => this.processNoteLink(content),
        ]);
    }

    private replaceLink(content: string, linkRegex: RegExp, template: (file: TFile) => string): string {
        return processTextExcludingCodeBlocks(content, (content) => {
            return content.replace(linkRegex, (match: string, selection: string) => {
                const file = this.app.metadataCache.getFirstLinkpathDest(selection, this.sourcePath);
                return file ? template(file) : match;
            });
        });
    }

    private processNoteImage(content: string): string {
        return this.replaceLink(content, /!\[\[(.*?)]]/g, (file) =>
            `![](${this.app.vault.getResourcePath(file)})`);
    }

    private processNoteLink(content: string): string {
        return this.replaceLink(content, /(?<!!)\[\[([^\]]+)]]/g, (file) =>
            `<a href="obsidian://open?file=${encodeURIComponent(file.path)}" target="_blank">${file.basename}</a>`);
    }
}

function processText(content: string, transforms: ((content: string) => string)[]): string {
    return transforms.reduce((content: string, transform: (content: string) => string) => {
        return transform(content);
    }, content);
}

function processLaTeX(content: string): string {
    return content
        .replace(/\\\[\s*/g, "$$")
        .replace(/\s*\\\]/g, "$$")
        .replace(/\\\(\s*/g, "$")
        .replace(/\s*\\\)/g, "$");
}

function processTextExcludingCodeBlocks(content: string, transform: (content: string) => string): string {
    const parts = content.split(/(```[\s\S]*?```|`[^`]*`)/g);
    return parts.map((part, index) => {
        if (index % 2 === 0) {
            return transform(part);
        }
        return part;
    }).join("");
}