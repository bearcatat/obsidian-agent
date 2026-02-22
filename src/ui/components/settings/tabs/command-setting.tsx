import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { FileCode, Terminal } from "lucide-react";
import React from "react";
import { CommandConfig } from "@/types";
import CommandLogic from "@/logic/command-logic";

export const CommandSetting: React.FC = () => {
  const [allCommands, setAllCommands] = React.useState<(CommandConfig & { builtin?: boolean })[]>([]);

  React.useEffect(() => {
    setAllCommands(CommandLogic.getInstance().getAllCommands());
  }, []);

  const builtinCommands = allCommands.filter(cmd => cmd.builtin);
  const userCommands = allCommands.filter(cmd => !cmd.builtin);

  return (
    <div className="tw-space-y-6">
      <div className="tw-text-sm tw-text-muted-foreground">
        Custom commands are stored as Markdown files in <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded">obsidian-agent/commands/</code>
      </div>

      {builtinCommands.length > 0 && (
        <section>
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
            <Terminal className="tw-size-5" />
            <span className="tw-text-lg tw-font-bold">Built-in Commands</span>
          </div>
          <div className="tw-border tw-rounded-lg tw-overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Command</TableHead>
                  <TableHead>Description</TableHead>
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
          <span className="tw-text-lg tw-font-bold">Custom Commands</span>
        </div>
        {userCommands.length === 0 ? (
          <div className="tw-border tw-rounded-lg tw-p-8 tw-text-center tw-text-muted-foreground">
            <FileCode className="tw-size-12 tw-mx-auto tw-mb-4 tw-opacity-50" />
            <p className="tw-mb-2">No custom commands found</p>
            <p className="tw-text-sm">
              Use <code className="tw-px-1 tw-py-0.5 tw-bg-muted tw-rounded">/create_command</code> to create a new command.
            </p>
          </div>
        ) : (
          <div className="tw-border tw-rounded-lg tw-overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Command</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>File</TableHead>
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
        <p className="tw-font-medium">Example command file:</p>
        <pre className="tw-bg-muted tw-p-3 tw-rounded-lg tw-overflow-x-auto tw-text-xs">
{`---
name: translate
description: Translate text to another language
---

Translate the following text to English:
$ARGUMENTS`}
        </pre>
        <p className="tw-text-xs">
          Use <code className="tw-px-1 tw-bg-muted tw-rounded">$ARGUMENTS</code> for all arguments, 
          or <code className="tw-px-1 tw-bg-muted tw-rounded">$1</code>, <code className="tw-px-1 tw-bg-muted tw-rounded">$2</code> for positional arguments.
        </p>
        <p className="tw-text-xs">
          Use <code className="tw-px-1 tw-bg-muted tw-rounded">@filepath</code> to reference note file contents.
        </p>
      </div>
    </div>
  );
};
