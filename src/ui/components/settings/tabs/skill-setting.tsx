import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { Target } from "lucide-react";
import React from "react";
import { SkillConfig } from "@/types";
import SkillLogic from "@/logic/skill-logic";
import { isBuiltinSkill } from "@/logic/builtin-skills";
import { useSkillStore } from "@/state/skill-state";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { useTranslation } from "../../../../i18n/react";

export const SkillSetting: React.FC = () => {
  const { t } = useTranslation("settings");
  const skills = useSkillStore((state) => state.skills);

  const handleToggleSkill = async (skill: SkillConfig, enabled: boolean) => {
    if (enabled) {
      await SkillLogic.getInstance().enableSkill(skill.name);
    } else {
      await SkillLogic.getInstance().disableSkill(skill.name);
    }
  };

  return (
    <div className="tw-space-y-6">
      <div className="tw-text-sm tw-text-muted-foreground">
        {t("skillsStored")} <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded">obsidian-agent/skills/{'{name}'}/SKILL.md</code>
      </div>

      <section>
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
          <Target className="tw-size-5" />
          <span className="tw-text-lg tw-font-bold">{t("skills")}</span>
        </div>
        
        {skills.filter(s => !isBuiltinSkill(s.name)).length === 0 ? (
          <div className="tw-border tw-rounded-lg tw-p-8 tw-text-center tw-text-muted-foreground">
            <Target className="tw-size-12 tw-mx-auto tw-mb-4 tw-opacity-50" />
            <p className="tw-mb-2">{t("noUserSkills")}</p>
            <p className="tw-text-sm">
              {t("createSkill", { skill: 'skill("create-skill")' })}
            </p>
          </div>
        ) : (
          <div className="tw-border tw-rounded-lg tw-overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="tw-w-20">{t('common:status')}</TableHead>
                  <TableHead>{t("skillLabel")}</TableHead>
                  <TableHead>{t('common:description')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.map((skill) => {
                  const isBuiltin = isBuiltinSkill(skill.name);
                  return (
                    <TableRow key={skill.name}>
                       <TableCell className="tw-w-20">
                         {isBuiltin ? (
                           <span 
                             className="tw-flex tw-items-center tw-justify-center tw-text-xs tw-text-muted-foreground"
                             title={t("builtinSkillTitle")}
                           >
                             {t("builtin")}
                           </span>
                         ) : (
                           <SettingSwitch
                             checked={skill.enabled}
                             onCheckedChange={(enabled) => handleToggleSkill(skill, enabled)}
                           />
                         )}
                       </TableCell>
                      <TableCell>
                        <code className={`tw-px-1 tw-py-0.5 tw-rounded ${isBuiltin ? 'tw-bg-blue-500/20 tw-text-blue-600 dark:tw-text-blue-400' : 'tw-bg-purple-500/20 tw-text-purple-600 dark:tw-text-purple-400'}`}>
                          {skill.name}
                        </code>
                      </TableCell>
                      <TableCell className="tw-text-muted-foreground">
                        {skill.description}
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
        <p className="tw-font-medium">{t("aboutSkills")}</p>
        <ul className="tw-list-disc tw-list-inside tw-space-y-1 tw-text-xs">
          <li>{t("userSkillsAbout", { skillName: "{skill-name}" })}</li>
          <li>{t("builtinSkillsAbout")}</li>
          <li>{t("toolTriggerAbout")}</li>
          <li>{t("sessionPersistenceAbout")}</li>
        </ul>
        
        <p className="tw-font-medium tw-mt-4">{t("exampleSkillFile")}</p>
        <pre className="tw-bg-muted tw-p-3 tw-rounded-lg tw-overflow-x-auto tw-text-xs">
{`---
name: translate-text
description: Guidelines for translating text to English
enabled: true
license: MIT
compatibility: opencode
metadata:
  language: en
---

When translating text to English:
1. Maintain the original meaning and tone
2. Use natural, idiomatic English
3. Preserve formatting and structure
4. Handle technical terms appropriately`}
        </pre>
      </div>
    </div>
  );
};
