import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { ShieldCheck } from "lucide-react";
import React from "react";
import { RuleConfig } from "@/types";
import RuleLogic from "@/logic/rule-logic";
import { useRuleStore } from "@/state/rule-state";
import { SettingSwitch } from "@/ui/elements/setting-switch";

export const RuleSetting: React.FC = () => {
  const rules = useRuleStore((state) => state.rules);

  const handleToggleRule = async (rule: RuleConfig, enabled: boolean) => {
    await RuleLogic.getInstance().setRuleEnabled(rule.name, enabled);
  };

  const scopeLabel = (scope: string) => {
    switch (scope) {
      case 'main': return 'Main only';
      case 'sub': return 'Sub only';
      default: return 'All agents';
    }
  };

  return (
    <div className="tw-space-y-6">
      <div className="tw-text-sm tw-text-muted-foreground">
        New rules are stored as markdown files in <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded">obsidian-agent/rules/{'{name}'}.md</code>. Legacy folders like <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded">obsidian-agent/rules/{'{name}'}/RULE.md</code> are still supported.
      </div>

      <section>
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
          <ShieldCheck className="tw-size-5" />
          <span className="tw-text-lg tw-font-bold">Rules</span>
        </div>

        {rules.length === 0 ? (
          <div className="tw-border tw-rounded-lg tw-p-8 tw-text-center tw-text-muted-foreground">
            <ShieldCheck className="tw-size-12 tw-mx-auto tw-mb-4 tw-opacity-50" />
            <p className="tw-mb-2">No rules found</p>
            <p className="tw-text-sm">
              Use the builtin skill <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded">skill({`"create-rule"`})</code> to create a new rule.
            </p>
          </div>
        ) : (
          <div className="tw-border tw-rounded-lg tw-overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="tw-w-20">Status</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead className="tw-w-32">Scope</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.name}>
                    <TableCell className="tw-w-20">
                      <SettingSwitch
                        checked={rule.enabled}
                        onCheckedChange={(enabled) => handleToggleRule(rule, enabled)}
                      />
                    </TableCell>
                    <TableCell>
                      <code className="tw-px-1 tw-py-0.5 tw-rounded tw-bg-orange-500/20 tw-text-orange-600 dark:tw-text-orange-400">
                        {rule.name}
                      </code>
                    </TableCell>
                    <TableCell className="tw-w-32">
                      <span className="tw-text-xs tw-text-muted-foreground">{scopeLabel(rule.scope)}</span>
                    </TableCell>
                    <TableCell className="tw-text-muted-foreground">
                      {rule.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="tw-text-sm tw-text-muted-foreground tw-space-y-2">
        <p className="tw-font-medium">About Rules:</p>
        <ul className="tw-list-disc tw-list-inside tw-space-y-1 tw-text-xs">
          <li><strong>Always active:</strong> Enabled rules are automatically injected into agent system prompts — no per-session activation needed</li>
          <li><strong>Scope "All":</strong> Injected into both the main agent and all sub-agents</li>
          <li><strong>Scope "Main only":</strong> Injected only into the main agent</li>
          <li><strong>Scope "Sub only":</strong> Injected only into sub-agent system prompts</li>
          <li><strong>Toggle:</strong> Enable/disable rules globally via the switch</li>
        </ul>

        <p className="tw-font-medium tw-mt-4">Example rule file:</p>
        <pre className="tw-bg-muted tw-p-3 tw-rounded-lg tw-overflow-x-auto tw-text-xs">
{`---
name: no-delete-without-confirm
description: Never delete files without explicit user confirmation
scope: all
enabled: true
---

Never delete, remove, or permanently destroy any file, note, or folder without first asking the user for explicit confirmation. Always describe what will be deleted and wait for the user to confirm before proceeding.`}
        </pre>
        <p className="tw-text-xs">Suggested path: <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded">obsidian-agent/rules/no-delete-without-confirm.md</code></p>
      </div>
    </div>
  );
};
