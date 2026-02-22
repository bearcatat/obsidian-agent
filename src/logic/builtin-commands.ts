import { CommandConfig } from '@/types';

export interface BuiltinCommandConfig extends CommandConfig {
  builtin: true;
}

// 内置命令列表（现在为空，create_command 和 create_skill 已转为 builtin-skills）
export const BUILTIN_COMMANDS: BuiltinCommandConfig[] = [];

export function getBuiltinCommand(name: string): BuiltinCommandConfig | undefined {
  return BUILTIN_COMMANDS.find(cmd => cmd.name === name);
}

export function isBuiltinCommand(name: string): boolean {
  return BUILTIN_COMMANDS.some(cmd => cmd.name === name);
}