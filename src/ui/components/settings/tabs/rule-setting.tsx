import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { ShieldCheck } from "lucide-react";
import React from "react";
import { RuleConfig } from "@/types";
import RuleLogic from "@/logic/rule-logic";
import { useRuleStore } from "@/state/rule-state";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { useTranslation } from "../../../../i18n/react";

export const RuleSetting: React.FC = () => {
  const { t } = useTranslation("settings");
  const rules = useRuleStore((state) => state.rules);

  const handleToggleRule = async (rule: RuleConfig, enabled: boolean) => {
    await RuleLogic.getInstance().setRuleEnabled(rule.name, enabled);
  };

  const scopeLabel = (scope: string) => {
    switch (scope) {
      case "main": return t("mainOnly");
      case "sub": return t("subOnly");
      default: return t("allAgents");
    }
  };

  return (
    <div className="tw-min-w-0 tw-max-w-full tw-space-y-6 tw-overflow-hidden">
      <div className="tw-min-w-0 tw-break-words tw-text-sm tw-text-muted-foreground">
        {t("rulesStored")} <code className="tw-whitespace-normal tw-break-all tw-rounded tw-bg-muted tw-px-1 tw-py-0.5">obsidian-agent/rules/{'{name}'}.md</code>. {t("legacyRulesSupported")} <code className="tw-whitespace-normal tw-break-all tw-rounded tw-bg-muted tw-px-1 tw-py-0.5">obsidian-agent/rules/{'{name}'}/RULE.md</code> {t("stillSupported")}
      </div>

      <section className="tw-min-w-0 tw-max-w-full">
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
          <ShieldCheck className="tw-size-5" />
          <span className="tw-text-lg tw-font-bold">{t("rules")}</span>
        </div>

        {rules.length === 0 ? (
          <div className="tw-min-w-0 tw-max-w-full tw-break-words tw-rounded-lg tw-border tw-p-8 tw-text-center tw-text-muted-foreground">
            <ShieldCheck className="tw-size-12 tw-mx-auto tw-mb-4 tw-opacity-50" />
            <p className="tw-mb-2">{t("noRules")}</p>
            <p className="tw-text-sm">
              {t("createRule", { skill: 'skill("create-rule")' })}
            </p>
          </div>
        ) : (
          <div className="tw-min-w-0 tw-max-w-full tw-overflow-hidden tw-rounded-lg tw-border">
            <Table className="tw-table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="tw-w-20">{t('common:status')}</TableHead>
                  <TableHead>{t("ruleLabel")}</TableHead>
                  <TableHead className="tw-w-32">{t("scope")}</TableHead>
                  <TableHead>{t('common:description')}</TableHead>
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
                    <TableCell className="tw-break-all">
                      <code className="tw-whitespace-normal tw-break-all tw-rounded tw-bg-orange-500/20 tw-px-1 tw-py-0.5 tw-text-orange-600 dark:tw-text-orange-400">
                        {rule.name}
                      </code>
                    </TableCell>
                    <TableCell className="tw-w-32">
                      <span className="tw-text-xs tw-text-muted-foreground">{scopeLabel(rule.scope)}</span>
                    </TableCell>
                    <TableCell className="tw-break-words tw-text-muted-foreground">
                      {rule.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="tw-min-w-0 tw-max-w-full tw-space-y-2 tw-break-words tw-text-sm tw-text-muted-foreground">
        <p className="tw-font-medium">{t("aboutRules")}</p>
        <ul className="tw-list-disc tw-list-inside tw-space-y-1 tw-text-xs">
          <li>{t("alwaysActiveAbout")}</li>
          <li>{t("scopeAllAbout")}</li>
          <li>{t("scopeMainAbout")}</li>
          <li>{t("scopeSubAbout")}</li>
          <li>{t("toggleRulesAbout")}</li>
        </ul>

        <p className="tw-font-medium tw-mt-4">{t("exampleRuleFile")}</p>
        <pre className="tw-max-w-full tw-whitespace-pre-wrap tw-break-words tw-rounded-lg tw-bg-muted tw-p-3 tw-text-xs">
{`---
name: no-delete-without-confirm
description: Never delete files without explicit user confirmation
scope: all
enabled: true
---

Never delete, remove, or permanently destroy any file, note, or folder without first asking the user for explicit confirmation. Always describe what will be deleted and wait for the user to confirm before proceeding.`}
        </pre>
        <p className="tw-text-xs">{t("suggestedPath")} <code className="tw-whitespace-normal tw-break-all tw-rounded tw-bg-muted tw-px-1 tw-py-0.5">obsidian-agent/rules/no-delete-without-confirm.md</code></p>
      </div>
    </div>
  );
};
