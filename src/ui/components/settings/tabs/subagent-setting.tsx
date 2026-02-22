import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { Users } from "lucide-react";
import React from "react";
import { SubAgentConfig } from "@/types";
import SubAgentLogic from "@/logic/subagent-logic";
import { useSubAgentStore } from "@/state/subagent-state";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import AIToolManager from "@/tool-ai/ToolManager";

export const SubAgentSetting: React.FC = () => {
  const subAgents = useSubAgentStore((state) => state.subAgents);

  const handleToggleSubAgent = async (subAgent: SubAgentConfig, enabled: boolean) => {
    await SubAgentLogic.getInstance().setSubAgentEnabled(subAgent.name, enabled);
    await AIToolManager.getInstance().updateSubAgents();
  };

  return (
    <div className="tw-space-y-6">
      <div className="tw-text-sm tw-text-muted-foreground">
        SubAgents are stored as AGENT.md files in <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded">obsidian-agent/subagents/{'{name}'}/AGENT.md</code>
      </div>

      <section>
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
          <Users className="tw-size-5" />
          <span className="tw-text-lg tw-font-bold">SubAgents</span>
        </div>
        
        {subAgents.length === 0 ? (
          <div className="tw-border tw-rounded-lg tw-p-8 tw-text-center tw-text-muted-foreground">
            <Users className="tw-size-12 tw-mx-auto tw-mb-4 tw-opacity-50" />
            <p className="tw-mb-2">No subagents found</p>
            <p className="tw-text-sm">
              Use the builtin skill <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded">skill({`"create-agent"`})</code> to create a new subagent.
            </p>
          </div>
        ) : (
          <div className="tw-border tw-rounded-lg tw-overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="tw-w-20">Status</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subAgents.map((subAgent) => {
                  return (
                    <TableRow key={subAgent.name}>
                      <TableCell className="tw-w-20">
                        <SettingSwitch
                          checked={subAgent.enabled}
                          onCheckedChange={(enabled) => handleToggleSubAgent(subAgent, enabled)}
                        />
                      </TableCell>
                      <TableCell>
                        <code className="tw-px-1 tw-py-0.5 tw-rounded tw-bg-green-500/20 tw-text-green-600 dark:tw-text-green-400">
                          {subAgent.name}
                        </code>
                      </TableCell>
                      <TableCell className="tw-text-muted-foreground">
                        {subAgent.description}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="tw-text-sm tw-text-muted-foreground tw-space-y-2">
        <p className="tw-font-medium">About SubAgents:</p>
        <ul className="tw-list-disc tw-list-inside tw-space-y-1 tw-text-xs">
          <li><strong>SubAgents:</strong> Specialized AI agents with custom system prompts</li>
          <li><strong>Model:</strong> SubAgents use the same model as the main agent</li>
          <li><strong>Toggle:</strong> Enable/disable subagents globally</li>
          <li><strong>File format:</strong> AGENT.md with frontmatter and system prompt body</li>
          <li><strong>Enabled:</strong> Set enabled in frontmatter to control global availability</li>
        </ul>
        
        <p className="tw-font-medium tw-mt-4">Example AGENT.md file:</p>
        <pre className="tw-bg-muted tw-p-3 tw-rounded-lg tw-overflow-x-auto tw-text-xs">
{`---
name: code-reviewer
description: Specialized agent for reviewing code changes
enabled: true
tools:
  - readNoteByPath
  - editFile
---

You are a specialized code reviewer. Your role is to:
- Review code for bugs, performance issues, and best practices
- Provide constructive feedback
- Suggest specific improvements

# Review Guidelines
1. Check for syntax errors
2. Look for potential bugs
3. Suggest performance improvements
4. Verify code style consistency`}
        </pre>
      </div>
    </div>
  );
};
