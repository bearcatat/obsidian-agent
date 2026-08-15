import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { FileCode, Terminal } from "lucide-react";
import React from "react";
import { CommandConfig } from "@/types";
import CommandLogic from "@/logic/command-logic";
import { useTranslation } from "../../../../i18n/react";

export const CommandSetting: React.FC = () => {
  const { t } = useTranslation("settings");
  const [allCommands, setAllCommands] = React.useState<(CommandConfig & { builtin?: boolean })[]>([]);

  React.useEffect(() => {
    setAllCommands(CommandLogic.getInstance().getAllCommands());
  }, []);

  const builtinCommands = allCommands.filter(cmd => cmd.builtin);
  const userCommands = allCommands.filter(cmd => !cmd.builtin);

  return (
    <div className="tw-space-y-6">
      <div className="tw-text-sm tw-text-muted-foreground">
        {t("commandsStored")} <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded">obsidian-agent/commands/</code>
      </div>

      {builtinCommands.length > 0 && (
        <section>
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
            <Terminal className="tw-size-5" />
            <span className="tw-text-lg tw-font-bold">{t("builtInCommands")}</span>
          </div>
          <div className="tw-border tw-rounded-lg tw-overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:command")}</TableHead>
                  <TableHead>{t("common:description")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {builtinCommands.map((command) => (
                  <TableRow key={command.name}>
                    <TableCell>
                      <code className="tw-px-1 tw-py-0.5 tw-bg-blue-500/20 tw-text-blue-600 dark:tw-text-blue-400 tw-rounded">
                        /{command.name}
                      </code>
                    </TableCell>
                    <TableCell className="tw-text-muted-foreground">
                      {command.description || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section>
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
          <FileCode className="tw-size-5" />
          <span className="tw-text-lg tw-font-bold">{t("customCommands")}</span>
        </div>
        {userCommands.length === 0 ? (
          <div className="tw-border tw-rounded-lg tw-p-8 tw-text-center tw-text-muted-foreground">
            <FileCode className="tw-size-12 tw-mx-auto tw-mb-4 tw-opacity-50" />
            <p className="tw-mb-2">{t("noCustomCommands")}</p>
            <p className="tw-text-sm">
              {t("createCommand", { command: "/create_command" })}
            </p>
          </div>
        ) : (
          <div className="tw-border tw-rounded-lg tw-overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:command")}</TableHead>
                  <TableHead>{t("common:description")}</TableHead>
                  <TableHead>{t("common:file")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userCommands.map((command) => (
                  <TableRow key={command.name}>
                    <TableCell>
                      <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded tw-text-primary">
                        /{command.name}
                      </code>
                    </TableCell>
                    <TableCell className="tw-text-muted-foreground">
                      {command.description || '-'}
                    </TableCell>
                    <TableCell className="tw-text-muted-foreground tw-text-sm">
                      {command.filePath?.split('/').pop() || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="tw-text-sm tw-text-muted-foreground tw-space-y-2">
        <p className="tw-font-medium">{t("exampleCommandFile")}</p>
        <pre className="tw-bg-muted tw-p-3 tw-rounded-lg tw-overflow-x-auto tw-text-xs">
{`---
name: translate
description: Translate text to another language
---

Translate the following text to English:
$ARGUMENTS`}
        </pre>
        <p className="tw-text-xs">
          {t("commandArguments", { arguments: "$ARGUMENTS", first: "$1", second: "$2" })}
        </p>
        <p className="tw-text-xs">
          {t("commandFileReference", { filepath: "@filepath" })}
        </p>
      </div>
    </div>
  );
};
