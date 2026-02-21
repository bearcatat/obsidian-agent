import { App, TFile, TFolder } from 'obsidian';
import { CommandConfig } from '../types';
import { commandStore } from '../state/command-state';
import { BUILTIN_COMMANDS, getBuiltinCommand, isBuiltinCommand, BuiltinCommandConfig } from './builtin-commands';

const COMMANDS_FOLDER = 'obsidian-agent/commands';

export class CommandLogic {
  private static instance: CommandLogic;
  private app: App | null = null;

  private constructor() {}

  static getInstance(): CommandLogic {
    if (!CommandLogic.instance) {
      CommandLogic.instance = new CommandLogic();
    }
    return CommandLogic.instance;
  }

  static resetInstance(): void {
    CommandLogic.instance = undefined as any;
  }

  setApp(app: App): void {
    this.app = app;
  }

  async loadCommands(): Promise<CommandConfig[]> {
    if (!this.app) {
      console.warn('CommandLogic: App not set');
      return [];
    }

    const commands: CommandConfig[] = [];
    const adapter = this.app.vault.adapter;

    try {
      if (!await adapter.exists(COMMANDS_FOLDER)) {
        await adapter.mkdir(COMMANDS_FOLDER);
        return [];
      }

      const files = await adapter.list(COMMANDS_FOLDER);
      
      for (const filePath of files.files) {
        if (filePath.endsWith('.md')) {
          const command = await this.loadCommandFile(filePath);
          if (command) {
            commands.push(command);
          }
        }
      }

      commandStore.getState().setCommands(commands);
      return commands;
    } catch (error) {
      console.error('Failed to load commands:', error);
      return [];
    }
  }

  private async loadCommandFile(filePath: string): Promise<CommandConfig | null> {
    if (!this.app) return null;

    try {
      const content = await this.app.vault.adapter.read(filePath);
      const { frontmatter, body } = this.parseFrontmatter(content);
      
      const name = frontmatter?.name || this.getFileNameWithoutExtension(filePath);
      
    return {
      name,
      template: body.trim(),
      description: frontmatter?.description,
      filePath,
    };
    } catch (error) {
      console.error(`Failed to load command file ${filePath}:`, error);
      return null;
    }
  }

  private parseFrontmatter(content: string): { frontmatter: Record<string, any> | null; body: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: null, body: content };
    }

    const frontmatterText = match[1];
    const body = match[2];
    const frontmatter: Record<string, any> = {};

    const lines = frontmatterText.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value: any = line.slice(colonIndex + 1).trim();
        
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(Number(value)) && value !== '') value = Number(value);
        
        if (key) {
          frontmatter[key] = value;
        }
      }
    }

    return { frontmatter, body };
  }

  private getFileNameWithoutExtension(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    return fileName.replace(/\.md$/, '');
  }

  parseInput(input: string): { commandName: string; args: string } | null {
    const trimmed = input.trim();
    const commandRegex = /^\/(\S+)\s*(.*)$/;
    const match = trimmed.match(commandRegex);

    if (!match) return null;

    return {
      commandName: match[1],
      args: match[2].trim(),
    };
  }

  expandTemplate(template: string, args: string): string {
    let result = template;

    result = result.replace(/\$ARGUMENTS/g, args);

    const argParts = args.split(/\s+/).filter(part => part.length > 0);
    for (let i = 0; i < argParts.length; i++) {
      result = result.replace(new RegExp(`\\$${i + 1}`, 'g'), argParts[i]);
    }

    // Restore escaped placeholders in documentation
    result = result.replace(/\$\\ARGUMENTS/g, '$ARGUMENTS');
    for (let i = 1; i <= 9; i++) {
      result = result.replace(new RegExp(`\\$\\\\${i}`, 'g'), `$${i}`);
    }

    return result;
  }

  async resolveFileReferences(template: string): Promise<string> {
    if (!this.app) return template;

    const fileRefRegex = /@([^\s\n]+)/g;
    const matches = [...template.matchAll(fileRefRegex)];

    let result = template;

    for (const match of matches) {
      const refPath = match[1];
      const fileContent = await this.readFileReference(refPath);
      if (fileContent !== null) {
        result = result.replace(match[0], fileContent);
      }
    }

    return result;
  }

  private async readFileReference(refPath: string): Promise<string | null> {
    if (!this.app) return null;

    let filePath = refPath;
    
    if (!filePath.endsWith('.md') && !filePath.includes('.')) {
      filePath += '.md';
    }

    const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
    if (abstractFile instanceof TFile) {
      try {
        return await this.app.vault.read(abstractFile);
      } catch (error) {
        console.error(`Failed to read file reference ${filePath}:`, error);
        return null;
      }
    }

    return null;
  }

  async processCommand(input: string): Promise<string | null> {
    const parsed = this.parseInput(input);
    if (!parsed) return null;

    const builtinCommand = getBuiltinCommand(parsed.commandName);
    if (builtinCommand) {
      let content = this.expandTemplate(builtinCommand.template, parsed.args);
      content = await this.resolveFileReferences(content);
      return content;
    }

    const commands = commandStore.getState().commands;
    const command = commands.find((c: CommandConfig) => c.name === parsed.commandName);

    if (!command) return null;

    let content = this.expandTemplate(command.template, parsed.args);
    content = await this.resolveFileReferences(content);

    return content;
  }

  getBuiltinCommands(): BuiltinCommandConfig[] {
    return BUILTIN_COMMANDS;
  }

  getAllCommands(): (CommandConfig & { builtin?: boolean })[] {
    const userCommands = commandStore.getState().commands;
    const builtinCommands = BUILTIN_COMMANDS.map(cmd => ({ ...cmd, builtin: true }));
    
    const filteredUserCommands = userCommands.filter(
      (cmd: CommandConfig) => !isBuiltinCommand(cmd.name)
    );
    
    return [...builtinCommands, ...filteredUserCommands];
  }

  getCommands(): CommandConfig[] {
    return commandStore.getState().commands;
  }

  getCommand(name: string): CommandConfig | undefined {
    return commandStore.getState().commands.find((c: CommandConfig) => c.name === name);
  }
}

export default CommandLogic;
