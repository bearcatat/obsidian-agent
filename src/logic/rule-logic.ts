import { App } from 'obsidian';
import { RuleConfig, RuleScope } from '../types';
import { ruleStore } from '../state/rule-state';

const RULES_FOLDER = 'obsidian-agent/rules';

type RuleFileFormat = 'flat' | 'legacy';

interface RuleFileCandidate {
  filePath: string;
  format: RuleFileFormat;
  storageName: string;
}

export class RuleLogic {
  private static instance: RuleLogic;
  private app: App | null = null;

  private constructor() {}

  static getInstance(): RuleLogic {
    if (!RuleLogic.instance) {
      RuleLogic.instance = new RuleLogic();
    }
    return RuleLogic.instance;
  }

  static resetInstance(): void {
    RuleLogic.instance = undefined as any;
  }

  setApp(app: App): void {
    this.app = app;
  }

  static getRuleFileCandidate(filePath: string): RuleFileCandidate | null {
    if (!filePath.startsWith(`${RULES_FOLDER}/`)) {
      return null;
    }

    const relativePath = filePath.slice(RULES_FOLDER.length + 1);
    const pathParts = relativePath.split('/');

    if (pathParts.length === 1 && filePath.endsWith('.md')) {
      return {
        filePath,
        format: 'flat',
        storageName: pathParts[0].slice(0, -3),
      };
    }

    if (pathParts.length === 2 && pathParts[1] === 'RULE.md') {
      return {
        filePath,
        format: 'legacy',
        storageName: pathParts[0],
      };
    }

    return null;
  }

  static isRuleFilePath(filePath: string): boolean {
    return RuleLogic.getRuleFileCandidate(filePath) !== null;
  }

  async loadRules(): Promise<RuleConfig[]> {
    if (!this.app) {
      console.warn('RuleLogic: App not set');
      return [];
    }

    const rules: RuleConfig[] = [];
    const adapter = this.app.vault.adapter;

    try {
      if (!await adapter.exists(RULES_FOLDER)) {
        await adapter.mkdir(RULES_FOLDER);
        ruleStore.getState().setRules(rules);
        return rules;
      }

      const entries = await adapter.list(RULES_FOLDER);
      const candidatesByStorageName = new Map<string, RuleFileCandidate>();
      const rulesByName = new Map<string, { rule: RuleConfig; format: RuleFileFormat }>();

      for (const filePath of entries.files) {
        const candidate = RuleLogic.getRuleFileCandidate(filePath);
        if (candidate?.format === 'flat') {
          candidatesByStorageName.set(candidate.storageName, candidate);
        }
      }

      for (const folderPath of entries.folders) {
        const ruleFilePath = `${folderPath}/RULE.md`;
        if (await adapter.exists(ruleFilePath)) {
          const candidate = RuleLogic.getRuleFileCandidate(ruleFilePath);
          if (candidate && !candidatesByStorageName.has(candidate.storageName)) {
            candidatesByStorageName.set(candidate.storageName, candidate);
          }
        }
      }

      for (const candidate of candidatesByStorageName.values()) {
        const rule = await this.loadRuleFile(candidate.filePath);
        if (!rule) {
          continue;
        }

        const existing = rulesByName.get(rule.name);
        if (!existing || candidate.format === 'flat') {
          rulesByName.set(rule.name, { rule, format: candidate.format });
        }
      }

      for (const entry of rulesByName.values()) {
        rules.push(entry.rule);
      }

      ruleStore.getState().setRules(rules);
      return rules;
    } catch (error) {
      console.error('Failed to load rules:', error);
      ruleStore.getState().setRules([]);
      return [];
    }
  }

  private async loadRuleFile(filePath: string): Promise<RuleConfig | null> {
    if (!this.app) return null;

    try {
      const content = await this.app.vault.adapter.read(filePath);
      const { frontmatter, body } = this.parseFrontmatter(content);

      if (!frontmatter?.name || !frontmatter?.description) {
        console.warn(`Rule file ${filePath} missing required frontmatter fields (name, description)`);
        return null;
      }

      const existingRule = ruleStore.getState().rules.find(r => r.name === frontmatter.name);
      const scope: RuleScope = (['all', 'main', 'sub'].includes(frontmatter.scope))
        ? frontmatter.scope as RuleScope
        : 'all';

      return {
        name: frontmatter.name,
        description: frontmatter.description,
        scope,
        body: body.trim(),
        filePath,
        enabled: frontmatter.enabled ?? existingRule?.enabled ?? true,
      };
    } catch (error) {
      console.error(`Failed to load rule file ${filePath}:`, error);
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

        if (key) {
          frontmatter[key] = value;
        }
      }
    }

    return { frontmatter, body };
  }

  getRules(): RuleConfig[] {
    return ruleStore.getState().rules;
  }

  getRuleByName(name: string): RuleConfig | undefined {
    return ruleStore.getState().rules.find(r => r.name === name);
  }

  /** Rules injected into the main agent system prompt */
  getRulesForMainAgent(): RuleConfig[] {
    return ruleStore.getState().rules.filter(
      r => r.enabled && (r.scope === 'all' || r.scope === 'main')
    );
  }

  /** Rules injected into sub-agent system prompts */
  getRulesForSubAgent(): RuleConfig[] {
    return ruleStore.getState().rules.filter(
      r => r.enabled && (r.scope === 'all' || r.scope === 'sub')
    );
  }

  async setRuleEnabled(name: string, enabled: boolean): Promise<void> {
    ruleStore.getState().setRuleEnabled(name, enabled);
    await this.updateRuleEnabledInFile(name, enabled);
  }

  private async updateRuleEnabledInFile(name: string, enabled: boolean): Promise<void> {
    const rule = this.getRuleByName(name);
    if (!rule || !rule.filePath) return;

    const ruleFileCandidate = RuleLogic.getRuleFileCandidate(rule.filePath);
    const targetFilePath = ruleFileCandidate?.format === 'legacy'
      ? `${RULES_FOLDER}/${name}.md`
      : rule.filePath;

    try {
      const content = await this.app!.vault.adapter.read(rule.filePath);
      const { frontmatter, body } = this.parseFrontmatter(content);
      if (!frontmatter) return;

      const updatedConfig: Omit<RuleConfig, 'filePath'> = {
        name: frontmatter.name,
        description: frontmatter.description,
        scope: frontmatter.scope ?? 'all',
        body: body.trim(),
        enabled,
      };

      const newContent = RuleLogic.formatRuleFile(updatedConfig);
      await this.app!.vault.adapter.write(targetFilePath, newContent);

      if (targetFilePath !== rule.filePath) {
        ruleStore.getState().updateRule({
          ...rule,
          enabled,
          filePath: targetFilePath,
        });
      }
    } catch (error) {
      console.error(`Failed to update rule enabled status in file:`, error);
    }
  }

  static validateRuleName(name: string): { valid: boolean; error?: string } {
    if (!name) {
      return { valid: false, error: 'Rule name is required' };
    }
    if (name.length < 1 || name.length > 64) {
      return { valid: false, error: 'Rule name must be 1-64 characters' };
    }
    const regex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!regex.test(name)) {
      return { valid: false, error: 'Rule name must be kebab-case (lowercase alphanumeric with hyphens)' };
    }
    return { valid: true };
  }

  static formatRuleFile(config: Omit<RuleConfig, 'filePath'>): string {
    const frontmatter = `---\nname: ${config.name}\ndescription: ${config.description}\nscope: ${config.scope}\nenabled: ${config.enabled}\n---\n\n`;
    return frontmatter + config.body;
  }
}

export default RuleLogic;
