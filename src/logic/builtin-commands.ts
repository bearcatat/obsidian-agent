import { CommandConfig } from '@/types';

export interface BuiltinCommandConfig extends CommandConfig {
  builtin: true;
}

export const BUILTIN_COMMANDS: BuiltinCommandConfig[] = [
  {
    name: 'compact',
    template: '/compact $ARGUMENTS',
    description: 'Compact older conversation context. Optional text sets the summary focus.',
    builtin: true,
  },
];

export function getBuiltinCommand(name: string): BuiltinCommandConfig | undefined {
  return BUILTIN_COMMANDS.find(cmd => cmd.name === name);
}

export function isBuiltinCommand(name: string): boolean {
  return BUILTIN_COMMANDS.some(cmd => cmd.name === name);
}
