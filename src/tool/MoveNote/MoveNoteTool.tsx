import { tool } from "ai";
import { z } from "zod";
import { TFile, TFolder, Vault, normalizePath } from "obsidian";
import { DESCRIPTION } from "./prompts";
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { MessageV2 } from "@/types";
import { fileMutex } from "@/tool-ai/FileEdit/mutex";

export const toolName = "moveNote";

interface MoveNoteResult {
  source_path: string;
  target_path: string;
}

function normalizeVaultPath(filePath: string, vault: Vault): string {
  let relativePath = filePath.trim().replace(/\\/g, "/");

  if (relativePath === "/") {
    return "";
  }

  if (relativePath.startsWith("/") || /^[A-Za-z]:/.test(relativePath)) {
    try {
      const vaultPath = ((vault.adapter as any).basePath || "").replace(/\\/g, "/");
      if (vaultPath && (relativePath === vaultPath || relativePath.startsWith(`${vaultPath}/`))) {
        relativePath = relativePath.slice(vaultPath.length).replace(/^\/+/, "");
      } else {
        relativePath = relativePath.replace(/^\/+/, "");
      }
    } catch (e) {
      relativePath = relativePath.replace(/^\/+/, "");
    }
  }

  return normalizePath(relativePath);
}

function getParentPath(filePath: string): string {
  const lastSlashIndex = filePath.lastIndexOf("/");
  return lastSlashIndex >= 0 ? filePath.substring(0, lastSlashIndex) : "";
}

async function ensureFolderExists(vault: Vault, folderPath: string): Promise<void> {
  if (!folderPath) {
    return;
  }

  const parts = folderPath.split("/").filter(Boolean);
  let currentPath = "";

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const existing = vault.getAbstractFileByPath(currentPath);

    if (existing instanceof TFolder) {
      continue;
    }

    if (existing) {
      throw new Error(`Cannot create folder "${currentPath}" because a file already exists at that path.`);
    }

    await vault.createFolder(currentPath);
  }
}

function resolveTargetPath(vault: Vault, sourceFile: TFile, targetPathInput: string, rawTargetPath: string): string {
  const targetFile = targetPathInput ? vault.getAbstractFileByPath(targetPathInput) : vault.getRoot();
  const rawTarget = rawTargetPath.trim().replace(/\\/g, "/");

  if (targetFile instanceof TFolder || rawTarget.endsWith("/")) {
    const folderPath = targetFile instanceof TFolder
      ? targetFile.path
      : targetPathInput.replace(/\/+$/, "");
    return folderPath ? normalizePath(`${folderPath}/${sourceFile.name}`) : sourceFile.name;
  }

  return targetPathInput;
}

export const MoveNoteTool = tool({
  title: toolName,
  description: DESCRIPTION,
  inputSchema: z.object({
    source_path: z.string().describe("要移动或重命名的现有笔记路径（相对于 vault 根目录，例如：'Projects/Old.md'）"),
    target_path: z.string().describe("目标笔记路径，或目标文件夹路径（相对于 vault 根目录，例如：'Archive/New.md' 或 'Archive/'）"),
  }),
  execute: async ({ source_path, target_path }, { toolCallId, experimental_context, abortSignal }) => {
    const context = experimental_context as { addMessage: (message: MessageV2) => void };
    const app = getGlobalApp();
    const vault = app.vault;
    let release: (() => void) | undefined;

    try {
      const sourcePath = normalizeVaultPath(source_path, vault);
      const targetPathInput = normalizeVaultPath(target_path, vault);

      if (!sourcePath) {
        throw new Error("source_path must be a note path, not the vault root.");
      }

      const sourceFile = vault.getAbstractFileByPath(sourcePath);
      if (!(sourceFile instanceof TFile)) {
        throw new Error(`Source note does not exist: "${sourcePath}"`);
      }

      const targetPath = resolveTargetPath(vault, sourceFile, targetPathInput, target_path);
      release = await fileMutex.acquire(sourcePath);

      if (abortSignal?.aborted) {
        throw new Error("Tool execution was cancelled.");
      }

      if (sourceFile.extension.toLowerCase() !== "md") {
        throw new Error(`Only Markdown notes can be moved, got: "${sourcePath}"`);
      }

      if (!targetPath || !targetPath.toLowerCase().endsWith(".md")) {
        throw new Error(`target_path must resolve to a Markdown note path ending with .md, got: "${targetPath}"`);
      }

      if (sourcePath === targetPath) {
        throw new Error("source_path and target_path resolve to the same note path.");
      }

      if (vault.getAbstractFileByPath(targetPath)) {
        throw new Error(`Destination already exists: "${targetPath}"`);
      }

      await ensureFolderExists(vault, getParentPath(targetPath));
      await app.fileManager.renameFile(sourceFile, targetPath);

      const moveResult: MoveNoteResult = {
        source_path: sourcePath,
        target_path: targetPath,
      };
      const toolMessage = ToolMessage.from(toolName, toolCallId ?? "");
      toolMessage.setContent(JSON.stringify({
        toolName,
        moveResult,
      }));
      toolMessage.setChildren(renderMoveNoteMessage(moveResult));
      toolMessage.close();
      context.addMessage(toolMessage);

      return JSON.stringify({
        success: "Note moved successfully",
        source_path: sourcePath,
        target_path: targetPath,
      });
    } catch (error) {
      if (!abortSignal?.aborted && !(error instanceof Error && error.message === "Tool execution was cancelled.")) {
        const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error);
        context.addMessage(errorMessage);
      }
      throw error;
    } finally {
      release?.();
    }
  },
});

export function renderMoveNoteMessage(moveResult: MoveNoteResult): React.ReactNode {
  return (
    <div className="tw-flex tw-items-center tw-gap-2 tw-rounded-md tw-border tw-border-solid tw-border-border tw-px-2 tw-py-1">
      <span>Moved note:</span>
      <span className="tw-font-mono tw-text-sm">{moveResult.source_path}</span>
      <span className="tw-text-muted-foreground">-&gt;</span>
      <span className="tw-font-mono tw-text-sm">{moveResult.target_path}</span>
    </div>
  );
}
