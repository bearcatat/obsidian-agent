import { SkillConfig } from '@/types';

export interface BuiltinSkillConfig extends SkillConfig {
  builtin: true;
}

// 内置技能：create-skill（指导用户创建技能）
const CREATE_SKILL_SKILL: BuiltinSkillConfig = {
  name: 'create-skill',
  description: 'Guides users through creating effective Agent Skills. Use when you want to create, write, or author a new skill, or asks about skill structure, best practices, or SKILL.md format.',
  body: `# Creating Skills

This skill guides you through creating effective Agent Skills. Skills are markdown files that teach the agent how to perform specific tasks: reviewing PRs using team standards, generating commit messages in a preferred format, querying database schemas, or any specialized workflow.

## Before You Begin: Gather Requirements

Before creating a skill, gather essential information from the user about:

1. **Purpose and scope**: What specific task or workflow should this skill help with?
2. **Target location**: Skills are stored in \`obsidian-agent/skills/<name>/SKILL.md\`
3. **Trigger scenarios**: When should the agent automatically apply this skill?
4. **Key domain knowledge**: What specialized information does the agent need?
5. **Output format preferences**: Are there specific templates or styles required?

## Skill File Structure

### Directory Layout

Skills are stored as directories containing a \`SKILL.md\` file:

\`\`\`
skill-name/
├── SKILL.md              # Required - main instructions
├── reference.md          # Optional - detailed documentation
├── examples.md           # Optional - usage examples
└── scripts/              # Optional - utility scripts
\`\`\`

### Storage Location

All skills are stored in: \`obsidian-agent/skills/<skill-name>/SKILL.md\`

### SKILL.md Structure

Every skill requires a \`SKILL.md\` file with YAML frontmatter and markdown body:

\`\`\`markdown
---
name: your-skill-name
description: Brief description of what this skill does and when to use it
---

# Your Skill Name

## Instructions
Clear, step-by-step guidance for the agent.

## Examples
Concrete examples of using this skill.
\`\`\`

### Required Metadata Fields

| Field | Requirements | Purpose |
|-------|--------------|---------|
| \`name\` | Max 64 chars, lowercase letters/numbers/hyphens only | Unique identifier |
| \`description\` | Max 1024 chars, non-empty | Helps agent decide when to apply |

## Writing Effective Descriptions

The description is **critical** for skill discovery. The agent uses it to decide when to apply your skill.

### Description Best Practices

1. **Write in third person**:
   - ✅ Good: "Processes Excel files and generates reports"
   - ❌ Avoid: "I can help you process Excel files"

2. **Be specific and include trigger terms**:
   - ✅ Good: "Extract text from PDF files. Use when working with PDFs or document extraction."
   - ❌ Vague: "Helps with documents"

3. **Include both WHAT and WHEN**:
   - WHAT: What the skill does
   - WHEN: When the agent should use it

## Core Authoring Principles

### 1. Concise is Key

The context window is shared with conversation history. Challenge each piece of information:
- "Does the agent really need this?"
- "Can I assume the agent knows this?"

### 2. Keep SKILL.md Under 500 Lines

For optimal performance, keep the main file concise.

### 3. Progressive Disclosure

Put essential info in SKILL.md; detailed content in separate files.

\`\`\`markdown
# PDF Processing

## Quick start
[Essential instructions]

## Additional resources
- For API details, see [reference.md](reference.md)
\`\`\`

## Creating a Skill

When the user wants to create a skill:

1. Gather requirements (purpose, triggers, format)
2. Suggest a skill name (lowercase, hyphens, max 64 chars)
3. Write a specific third-person description
4. Create the SKILL.md content
5. Use the \`createArtifact\` tool with type="skill"

Example:
\`\`\`
createArtifact({
  type: "skill",
  name: "pdf-extract",
  description: "Extract text from PDF files. Use when processing PDFs.",
  content: "## Instructions\\n\\nUse pdfplumber for extraction..."
})
\`\`\`

## Summary Checklist

Before finalizing a skill:
- [ ] Description is specific with trigger terms
- [ ] Written in third person
- [ ] SKILL.md under 500 lines
- [ ] Consistent terminology
- [ ] Path: obsidian-agent/skills/<name>/SKILL.md`,
  license: 'MIT',
  compatibility: 'obsidian-agent',
  filePath: 'builtin://create-skill',
  enabled: false,
  builtin: true,
};

// 内置技能：create-command（指导用户创建命令）
const CREATE_COMMAND_SKILL: BuiltinSkillConfig = {
  name: 'create-command',
  description: 'Guides users through creating custom commands for quick prompt templates. Use when you want to create reusable command shortcuts or asks about command structure and best practices.',
  body: `# Creating Commands

This skill guides you through creating custom commands. Commands are quick shortcuts that expand into full prompt templates, perfect for repetitive tasks.

## What are Commands?

Commands are stored in \`obsidian-agent/commands/<name>.md\` and can be triggered with \`/<command-name>\`.

Unlike skills (which provide ongoing guidance), commands expand into a single prompt template.

## Command Structure

### File Format

\`\`\`markdown
---
name: command-name
description: Brief description of what this command does
---

Your prompt template here.
Use \`$ARGUMENTS\` for user input.
Use \`$1\`, \`$2\` for positional arguments.
\`\`\`

### Storage Location

All commands are stored in: \`obsidian-agent/commands/<command-name>.md\`

### Naming Convention

- Lowercase with underscores (e.g., \`translate_text\`, \`summarize_note\`)
- Max 64 characters
- Must be unique

## Creating a Command

When the user wants to create a command:

1. **Understand the use case**: What repetitive task needs a shortcut?

2. **Choose a name**: Lowercase, underscores, descriptive
   - Examples: \`translate_text\`, \`fix_grammar\`, \`add_todos\`

3. **Write a description**: Brief, clear, third person
   - Example: "Translate text to English"

4. **Create the template**: The actual prompt that will be sent
   - Use \`$ARGUMENTS\` for all user input
   - Use \`$1\`, \`$2\`, etc. for specific arguments

5. **Use createArtifact tool**: Type="command"

## Template Examples

### Simple Translation

\`\`\`markdown
---
name: translate_text
description: Translate text to English
---

Translate the following text to English:

$ARGUMENTS

Maintain the original tone and formatting.
\`\`\`

### With Positional Arguments

\`\`\`markdown
---
name: format_code
description: Format code in specified language
---

Format this $1 code:

\`\`\`$1
$2
\`\`\`

Follow standard style guidelines for $1.
\`\`\`

Usage: \`/format_code python "def hello(): pass"\`

### With File References

\`\`\`markdown
---
name: summarize_note
description: Summarize the content of a note
---

Summarize the key points from this note:

@$1

Provide a 2-3 sentence summary.
\`\`\`

Usage: \`/summarize_note my-note.md\`

## Creating Commands

Use the \`createArtifact\` tool with type="command":

\`\`\`
createArtifact({
  type: "command",
  name: "summarize",
  description: "Summarize text concisely",
  content: "Summarize the following:\\n\\n$ARGUMENTS"
})
\`\`\`

## Best Practices

1. **Keep templates focused**: One task per command
2. **Use clear variable names**: $ARGUMENTS for general input
3. **Provide examples**: In the description or as comments
4. **Test the command**: After creation, try using it

## Reserved Names

Cannot use these names (reserved by system):
- \`create_skill\`, \`create_command\` (use skills instead)
- Any existing builtin commands

## Summary Checklist

- [ ] Name uses lowercase with underscores
- [ ] Description is clear and specific
- [ ] Template uses $ARGUMENTS appropriately
- [ ] File will be created at obsidian-agent/commands/<name>.md`,
  license: 'MIT',
  compatibility: 'obsidian-agent',
  filePath: 'builtin://create-command',
  enabled: false,
  builtin: true,
};

export const BUILTIN_SKILLS: BuiltinSkillConfig[] = [
  CREATE_SKILL_SKILL,
  CREATE_COMMAND_SKILL,
];

export function getBuiltinSkill(name: string): BuiltinSkillConfig | undefined {
  return BUILTIN_SKILLS.find(skill => skill.name === name);
}

export function isBuiltinSkill(name: string): boolean {
  return BUILTIN_SKILLS.some(skill => skill.name === name);
}

export function getAllBuiltinSkills(): BuiltinSkillConfig[] {
  return [...BUILTIN_SKILLS];
}

// 获取所有保留名（包括 builtin 命令和 builtin 技能）
export function getReservedNames(): string[] {
  // 需要导入 builtin-commands 来合并
  // 暂时只返回 builtin skills，后面会更新
  return BUILTIN_SKILLS.map(s => s.name);
}