import { App, TFile } from 'obsidian';
import { SkillConfig } from '../types';
import { skillStore } from '../state/skill-state';
import { BUILTIN_SKILLS, getBuiltinSkill, isBuiltinSkill } from './builtin-skills';

const SKILLS_FOLDER = 'obsidian-agent/skills';

export class SkillLogic {
  private static instance: SkillLogic;
  private app: App | null = null;
  private sessionActiveSkills: Set<string> = new Set();

  private constructor() {}

  static getInstance(): SkillLogic {
    if (!SkillLogic.instance) {
      SkillLogic.instance = new SkillLogic();
    }
    return SkillLogic.instance;
  }

  static resetInstance(): void {
    SkillLogic.instance = undefined as any;
  }

  setApp(app: App): void {
    this.app = app;
  }

  // 加载所有 skills
  async loadSkills(): Promise<SkillConfig[]> {
    if (!this.app) {
      console.warn('SkillLogic: App not set');
      return [];
    }

    const skills: SkillConfig[] = [];
    const adapter = this.app.vault.adapter;

    try {
      if (!await adapter.exists(SKILLS_FOLDER)) {
        await adapter.mkdir(SKILLS_FOLDER);
        skillStore.getState().setSkills(skills);
        return skills;
      }

      const entries = await adapter.list(SKILLS_FOLDER);
      
      for (const folderPath of entries.folders) {
        const skillFilePath = `${folderPath}/SKILL.md`;
        if (await adapter.exists(skillFilePath)) {
          const skill = await this.loadSkillFile(skillFilePath);
          if (skill) {
            skills.push(skill);
          }
        }
      }

      // 合并内置技能（用户技能优先，避免覆盖）
      const userSkillNames = new Set(skills.map(s => s.name));
      const builtinSkillsToAdd = BUILTIN_SKILLS.filter(bs => !userSkillNames.has(bs.name));
      const allSkills = [...skills, ...builtinSkillsToAdd];

      skillStore.getState().setSkills(allSkills);
      return allSkills;
    } catch (error) {
      console.error('Failed to load skills:', error);
      // 即使加载失败，也返回内置技能
      skillStore.getState().setSkills([...BUILTIN_SKILLS]);
      return [...BUILTIN_SKILLS];
    }
  }

  // 加载单个 skill 文件
  private async loadSkillFile(filePath: string): Promise<SkillConfig | null> {
    if (!this.app) return null;

    try {
      const content = await this.app.vault.adapter.read(filePath);
      const { frontmatter, body } = this.parseFrontmatter(content);
      
      if (!frontmatter?.name || !frontmatter?.description) {
        console.warn(`Skill file ${filePath} missing required frontmatter fields`);
        return null;
      }

      const existingSkill = skillStore.getState().skills.find(s => s.name === frontmatter.name);
      
      return {
        name: frontmatter.name,
        description: frontmatter.description,
        body: body.trim(),
        license: frontmatter.license,
        compatibility: frontmatter.compatibility,
        metadata: frontmatter.metadata,
        filePath,
        enabled: existingSkill?.enabled ?? false,
      };
    } catch (error) {
      console.error(`Failed to load skill file ${filePath}:`, error);
      return null;
    }
  }

  // 解析 frontmatter
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
    let metadata: Record<string, string> = {};

    for (const line of lines) {
      // 检查是否是 metadata 块
      if (line.trim() === 'metadata:') {
        currentKey = 'metadata';
        continue;
      }

      // 如果是 metadata 的子项
      if (currentKey === 'metadata' && line.startsWith('  ')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const metaKey = line.slice(2, colonIndex).trim();
          const metaValue = line.slice(colonIndex + 1).trim();
          metadata[metaKey] = metaValue;
        }
        continue;
      }

      // 重置 currentKey
      if (currentKey === 'metadata' && !line.startsWith('  ') && line.trim() !== '') {
        currentKey = null;
      }

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

    if (Object.keys(metadata).length > 0) {
      frontmatter.metadata = metadata;
    }

    return { frontmatter, body };
  }

  // 获取所有 skills
  getSkills(): SkillConfig[] {
    return skillStore.getState().skills;
  }

  // 通过名称获取 skill
  getSkillByName(name: string): SkillConfig | undefined {
    return skillStore.getState().skills.find(s => s.name === name);
  }

  // 启用 skill（全局）
  enableSkill(name: string): void {
    skillStore.getState().setSkillEnabled(name, true);
  }

  // 禁用 skill（全局）
  disableSkill(name: string): void {
    skillStore.getState().setSkillEnabled(name, false);
  }

  // 会话级：激活 skill
  activateSessionSkill(name: string): boolean {
    const skill = this.getSkillByName(name);
    if (!skill) return false;
    this.sessionActiveSkills.add(name);
    return true;
  }

  // 会话级：停用 skill
  deactivateSessionSkill(name: string): boolean {
    return this.sessionActiveSkills.delete(name);
  }

  // 获取当前会话激活的 skills
  getSessionActiveSkills(): SkillConfig[] {
    return Array.from(this.sessionActiveSkills)
      .map(name => this.getSkillByName(name))
      .filter((s): s is SkillConfig => s !== undefined);
  }

  // 获取全局启用的 skills
  getEnabledSkills(): SkillConfig[] {
    return skillStore.getState().skills.filter(s => s.enabled);
  }

  // 获取所有应用到当前对话的 skills（全局启用 + 会话激活）
  getActiveSkillsForSession(): SkillConfig[] {
    const enabled = this.getEnabledSkills();
    const sessionActive = this.getSessionActiveSkills();
    
    // 合并，避免重复
    const allNames = new Set([...enabled.map(s => s.name), ...sessionActive.map(s => s.name)]);
    return Array.from(allNames)
      .map(name => this.getSkillByName(name))
      .filter((s): s is SkillConfig => s !== undefined);
  }

  // 清除会话激活状态
  clearSessionSkills(): void {
    this.sessionActiveSkills.clear();
  }

  // 解析技能命令（/skill-name）
  parseSkillCommand(input: string): { type: 'activate' | null; skillName: string | null; args: string } | null {
    const trimmed = input.trim();

    // 检查是否是技能触发命令（/skill-name args）
    const skillMatch = trimmed.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\s*(.*)$/);
    if (skillMatch) {
      const name = skillMatch[1];
      // 检查是否是 builtin 命令
      if (this.isBuiltinCommand(name)) {
        return null;
      }
      // 检查是否是 skill
      const skill = this.getSkillByName(name);
      if (skill) {
        return {
          type: 'activate',
          skillName: name,
          args: skillMatch[2],
        };
      }
    }

    return null;
  }

  // 检查是否是 builtin 技能（这些技能只能通过 skill 工具加载，不能通过命令触发）
  private isBuiltinCommand(name: string): boolean {
    // 内置技能名称（使用连字符命名）
    const builtinSkills = ['create-skill', 'create-command'];
    return builtinSkills.includes(name);
  }

  // 验证 skill 名称（OpenCode 规范）
  static validateSkillName(name: string): { valid: boolean; error?: string } {
    if (!name) {
      return { valid: false, error: 'Skill name is required' };
    }
    
    if (name.length < 1 || name.length > 64) {
      return { valid: false, error: 'Skill name must be 1-64 characters' };
    }

    const regex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!regex.test(name)) {
      return { valid: false, error: 'Skill name must be lowercase alphanumeric with single hyphen separators' };
    }

    return { valid: true };
  }

  // 格式化 skill 文件内容
  static formatSkillFile(config: Omit<SkillConfig, 'filePath' | 'enabled'>): string {
    let frontmatter = `---\nname: ${config.name}\ndescription: ${config.description}`;
    
    if (config.license) {
      frontmatter += `\nlicense: ${config.license}`;
    }
    
    if (config.compatibility) {
      frontmatter += `\ncompatibility: ${config.compatibility}`;
    }
    
    if (config.metadata && Object.keys(config.metadata).length > 0) {
      frontmatter += '\nmetadata:';
      for (const [key, value] of Object.entries(config.metadata)) {
        frontmatter += `\n  ${key}: ${value}`;
      }
    }
    
    frontmatter += '\n---\n\n';
    
    return frontmatter + config.body;
  }
}

export default SkillLogic;