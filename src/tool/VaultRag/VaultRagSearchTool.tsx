import { tool } from "ai";
import { z } from "zod";
import { ToolMessage } from "@/messages/tool-message";
import type { MessageV2 } from "@/types";
import VaultRagService, { type RagSearchResponse } from "@/retrieval/VaultRagService";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import { getGlobalApp } from "@/utils";
import { ChevronsUpDown } from "lucide-react";
import React from "react";

export const toolName = "vaultRagSearch";

export const VaultRagSearchTool = tool({
  title: toolName,
  description: "Search semantically relevant passages from the current Vault's indexed Markdown notes. Use this when the answer may be in the Vault.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Natural-language search query"),
    limit: z.number().min(1).max(10).default(5).describe("Maximum number of matching passages"),
  }),
  execute: async ({ query, limit }, { toolCallId, experimental_context, abortSignal }) => {
    const context = experimental_context as { addMessage: (message: MessageV2) => void };
    const response = await VaultRagService.getInstance().search(query, limit, abortSignal);
    const message = ToolMessage.from(toolName, toolCallId);
    message.setContent(JSON.stringify({ query, response }));
    message.setChildren(renderVaultRagMessage(response, query));
    message.close();
    context.addMessage(message);
    return formatForAgent(response);
  },
});

export function renderVaultRagMessage(response: RagSearchResponse, query?: string): React.ReactNode {
  const successful = response.hits.filter((hit) => hit.content !== undefined);
  const hasFailure = response.hits.some((hit) => hit.failure);
  return (
    <Collapsible className="tw-w-full tw-rounded-md tw-border tw-border-solid tw-border-border tw-py-1">
      <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-0">
        <div className="tw-min-w-0 tw-truncate tw-text-xs tw-text-muted-foreground">
          Vault RAG: {query ? `“${query}” · ` : ""}{response.state === "empty" ? "no matches" : `${successful.length} result${successful.length === 1 ? "" : "s"}`}
          {hasFailure ? " (partial success)" : ""}
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="tw-size-8" aria-label="Toggle Vault RAG results"><ChevronsUpDown className="tw-size-4" /></Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="tw-px-2 tw-pb-2">
        {response.message && <div className="tw-mt-2 tw-text-xs tw-text-muted-foreground">{response.message}</div>}
        {successful.length > 0 && <div className="tw-mt-2 tw-max-h-64 tw-overflow-y-auto">
          <table className="tw-w-full tw-text-xs" aria-label="Vault RAG results">
            <thead className="tw-sr-only"><tr><th>Note</th><th>Score</th></tr></thead>
            <tbody>{successful.map((hit) => <tr key={`${hit.path}:${hit.startLine}:${hit.endLine}`}>
              <td className="tw-min-w-0 tw-py-0.5"><span role="link" tabIndex={0} className="tw-cursor-pointer tw-font-mono tw-text-xs" aria-label={`Open ${noteName(hit.path)}`} onClick={() => openNote(hit.path)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openNote(hit.path); } }}>{noteName(hit.path)}</span></td>
              <td className="tw-w-16 tw-py-0.5 tw-text-right tw-tabular-nums tw-text-muted-foreground">{hit.score.toFixed(3)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </CollapsibleContent>
    </Collapsible>
  );
}

function formatForAgent(response: RagSearchResponse): string {
  if (response.state === "disabled" || response.state === "not-ready") return response.message ?? "Vault RAG is unavailable.";
  if (response.state === "empty") return "No matching Vault passages were found.";
  const successful = response.hits.filter((hit) => hit.content !== undefined);
  const failures = response.hits.filter((hit) => hit.failure);
  const parts = successful.map((hit) => `[${hit.path}:${hit.startLine}-${hit.endLine}, score ${hit.score.toFixed(3)}]\n${hit.content}`);
  if (failures.length) parts.push(`Some matches were not returned: ${failures.map((hit) => `${hit.path} (${hit.failure === "stale" ? "content changed after indexing" : "cannot read"})`).join(", ")}.`);
  return parts.join("\n\n") || response.message || "Matching notes could not be read.";
}

function openNote(path: string): void {
  const file = getGlobalApp().vault.getAbstractFileByPath(path);
  if (file && "extension" in file && file.extension === "md") void getGlobalApp().workspace.getLeaf(true).openFile(file as any);
}

function noteName(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
}
