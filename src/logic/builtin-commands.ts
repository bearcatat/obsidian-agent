import { CommandConfig } from '@/types';

export interface BuiltinCommandConfig extends CommandConfig {
  builtin: true;
}

export const BUILTIN_COMMANDS: BuiltinCommandConfig[] = [
  {
    name: 'create_command',
    description: 'Create a new custom command',
    template: `Help the user create a new custom command file.

User input: $ARGUMENTS

Based on the user input, intelligently determine what they want:
- If empty: Ask what command they want to create
- If it looks like a command name (e.g., "translate_text"): Use it as the name, ask for description and template
- If it describes an intent (e.g., "translate text to English"): Generate appropriate name, description, and template

Follow these steps:
1. Understand the user's intent from their input
2. Suggest or confirm a command name (lowercase, use underscores)
3. Write a brief description
4. Create the template content
5. Use the createCommand tool to create the file

Command file format:
---
name: {command_name}
description: {description}
---
{template content}

Template features:
- Use \`$\ARGUMENTS\` for all user arguments
- Use \`$\\1\`, \`$\\2\`, \`$\\3\` for positional arguments
- Use \`@filepath\` to reference note file contents
- Use \`@{dir:path}\` to reference folder contents`,
    builtin: true,
  },
];

export function getBuiltinCommand(name: string): BuiltinCommandConfig | undefined {
  return BUILTIN_COMMANDS.find(cmd => cmd.name === name);
}

export function isBuiltinCommand(name: string): boolean {
  return BUILTIN_COMMANDS.some(cmd => cmd.name === name);
}
