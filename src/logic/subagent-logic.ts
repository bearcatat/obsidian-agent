import { App } from 'obsidian';
import { SubAgentConfig } from '../types';
import { subAgentStore } from '../state/subagent-state';

const SUBAGENTS_FOLDER = 'obsidian-agent/subagents';

export class SubAgentLogic {
  private static instance: SubAgentLogic;
  private app: App | null = null;

  private constructor() {}

  static getInstance(): SubAgentLogic {
    if (!SubAgentLogic.instance) {
      SubAgentLogic.instance = new SubAgentLogic();
    }
    return SubAgentLogic.instance;
  }

  static resetInstance(): void {
    SubAgentLogic.instance = undefined as any;
  }

  setApp(app: App): void {
    this.app = app;
  }

  async loadSubAgents(): Promise<SubAgentConfig[]> {
    if (!this.app) {
      console.warn('SubAgentLogic: App not set');
      return [];
    }

    const subAgents: SubAgentConfig[] = [];
    const adapter = this.app.vault.adapter;

    try {
      if (!await adapter.exists(SUBAGENTS_FOLDER)) {
        await adapter.mkdir(SUBAGENTS_FOLDER);
        subAgentStore.getState().setSubAgents(subAgents);
        return subAgents;
      }

      const entries = await adapter.list(SUBAGENTS_FOLDER);

      for (const folderPath of entries.folders) {
        const agentFilePath = `${folderPath}/AGENT.md`;
        if (await adapter.exists(agentFilePath)) {
          const subAgent = await this.loadSubAgentFile(agentFilePath);
          if (subAgent) {
            subAgents.push(subAgent);
          }
        }
      }

      subAgentStore.getState().setSubAgents(subAgents);
      return subAgents;
    } catch (error) {
      console.error('Failed to load subagents:', error);
      subAgentStore.getState().setSubAgents([]);
      return [];
    }
  }

  private async loadSubAgentFile(filePath: string): Promise<SubAgentConfig | null> {
    if (!this.app) return null;

    try {
      const content = await this.app.vault.adapter.read(filePath);
      const { frontmatter, body } = this.parseFrontmatter(content);

      if (!frontmatter?.name || !frontmatter?.description) {
        console.warn(`SubAgent file ${filePath} missing required frontmatter fields (name, description)`);
        return null;
      }

      const existingSubAgent = subAgentStore.getState().subAgents.find(s => s.name === frontmatter.name);

      return {
        name: frontmatter.name,
        description: frontmatter.description,
        systemPrompt: body.trim(),
        enabled: frontmatter.enabled ?? existingSubAgent?.enabled ?? true,
        tools: frontmatter.tools || [],
        filePath,
        builtin: false,
      };
    } catch (error) {
      console.error(`Failed to load subagent file ${filePath}:`, error);
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
    let currentKey: string | null = null;
    let toolsArray: string[] = [];

    for (const line of lines) {
      if (line.trim() === 'tools:' || line.trim() === 'tools :') {
        currentKey = 'tools';
        continue;
      }

      if (currentKey === 'tools' && line.startsWith('  - ')) {
        const toolName = line.slice(4).trim();
        if (toolName) {
          toolsArray.push(toolName);
        }
        continue;
      }

      if (currentKey === 'tools' && !line.startsWith('  ') && line.trim() !== '') {
        currentKey = null;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex > 0 && currentKey !== 'tools') {
        const key = line.slice(0, colonIndex).trim();
        let value: any = line.slice(colonIndex + 1).trim();

        if (value === 'true') value = true;
        else if (value === 'false') value = false;

        if (key) {
          frontmatter[key] = value;
        }
      }
    }

    if (toolsArray.length > 0) {
      frontmatter.tools = toolsArray;
    }

    return { frontmatter, body };
  }

  getSubAgents(): SubAgentConfig[] {
    return subAgentStore.getState().subAgents;
  }

  getSubAgentByName(name: string): SubAgentConfig | undefined {
    return subAgentStore.getState().subAgents.find(s => s.name === name);
  }

  getEnabledSubAgents(): SubAgentConfig[] {
    return subAgentStore.getState().subAgents.filter(s => s.enabled);
  }

  async setSubAgentEnabled(name: string, enabled: boolean): Promise<void> {
    subAgentStore.getState().setSubAgentEnabled(name, enabled);
    await this.updateSubAgentEnabledInFile(name, enabled);
  }

  private async updateSubAgentEnabledInFile(name: string, enabled: boolean): Promise<void> {
    const subAgent = this.getSubAgentByName(name);
    if (!subAgent || !subAgent.filePath) {
      return;
    }

    try {
      const content = await this.app!.vault.adapter.read(subAgent.filePath);
      const { frontmatter, body } = this.parseFrontmatter(content);
      
      if (!frontmatter) {
        return;
      }
      
      const updatedConfig = {
        name: frontmatter.name,
        description: frontmatter.description,
        systemPrompt: body.trim(),
        enabled,
        tools: frontmatter.tools || [],
      };
      
      const newContent = SubAgentLogic.formatSubAgentFile(updatedConfig);
      await this.app!.vault.adapter.write(subAgent.filePath, newContent);
    } catch (error) {
      console.error(`Failed to update subagent enabled status in file:`, error);
    }
  }

  static validateSubAgentName(name: string): { valid: boolean; error?: string } {
    if (!name) {
      return { valid: false, error: 'SubAgent name is required' };
    }

    if (name.length < 1 || name.length > 64) {
      return { valid: false, error: 'SubAgent name must be 1-64 characters' };
    }

    const regex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!regex.test(name)) {
      return { valid: false, error: 'SubAgent name must be lowercase alphanumeric with single hyphen separators (kebab-case)' };
    }

    return { valid: true };
  }

  static formatSubAgentFile(config: Omit<SubAgentConfig, 'filePath' | 'builtin'>): string {
    let frontmatter = `---\nname: ${config.name}\ndescription: ${config.description}\nenabled: ${config.enabled}`;

    if (config.tools && config.tools.length > 0) {
      frontmatter += '\ntools:';
      for (const tool of config.tools) {
        frontmatter += `\n  - ${tool}`;
      }
    }

    frontmatter += '\n---\n\n';

    return frontmatter + config.systemPrompt;
  }
}

export default SubAgentLogic;
