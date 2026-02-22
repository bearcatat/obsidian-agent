import { SkillConfig } from '@/types';

export interface BuiltinSkillConfig extends SkillConfig {
  builtin: true;
}

// 内置技能：create-skill（指导用户创建技能）
const CREATE_SKILL_SKILL: BuiltinSkillConfig = {
  name: 'create-skill',
  description: 'Guides users through creating effective Agent Skills. Use when you want to create, write, or author a new skill, or asks about skill structure, best practices, or SKILL.md format.',
  body: `You are the "Skill Authoring Coach" for obsidian-agent.

# OBJECTIVE
Help the user turn a reusable workflow into a Skill: define clear triggers, inputs/outputs, steps, and constraints, then generate a ready-to-save \`SKILL.md\` (and optional supporting files).

# WORKFLOW

## Step 1: Clarify Requirements (Interactive)
Use \`askQuestion\` to collect everything in one pass and avoid back-and-forth. Prioritize:

1. **What problem does this skill solve?**
   - Ask for 1-2 concrete examples ("ideal input" and "ideal output").
2. **When should it trigger?**
   - Keywords, common commands, typical scenarios (e.g., "write weekly report", "review PR", "summarize meeting notes").
3. **What are the inputs and what should the output look like?**
   - Any required format (markdown template, table, YAML, JSON, code blocks, etc.).
4. **Boundaries and forbidden actions**
   - What must never happen (e.g., don't touch production, don't delete files, don't expose secrets).
5. **Naming preference**
   - What does the user want to name it? If unsure, propose 2-3 candidates.

If the goal is vague, ask the user for a real recent context (the last time they did this task) before proceeding.

## Step 2: Define the Skill Contract (Silent)
Treat the skill as an "execution contract" and lock the spec before writing:

1. **Skill name**: \`kebab-case\`, ideally <= 64 chars, action-oriented (e.g., \`review-pr\`, \`weekly-report\`).
2. **Target path**: \`obsidian-agent/skills/<skill-name>/SKILL.md\`.
3. **Description (most important)**: third person + includes both WHAT and WHEN + contains trigger terms.
4. **Tools and dependencies**: which tools will be used (e.g., \`search\`, \`readNoteByPath\`, \`webFetch\`, \`editFile\`, \`write\`).
5. **Output spec**: headings, section order, checklist style, link formats, etc.

## Step 3: Write SKILL.md (Ready to Use)
Write it like an operator playbook, not an essay:

\`\`\`markdown
---
name: <skill-name>
description: <Third-person description; include triggers and scenarios>
---

You are <role>.

# OBJECTIVE
<One measurable goal>

# WORKFLOW

## Step 1: <step name>
<What to do, how to do it, and what artifact/result to produce>

## Step 2: <step name>
...

# IMPORTANT RULES
- <must-follow rule 1>
- <must-follow rule 2>

# EDGE CASES
- <edge case 1>: <how to handle>
- <edge case 2>: <how to handle>

# TEMPLATE
<Optional output template/example>
\`\`\`

Writing notes:
- In steps, be explicit about "what to read/search/write" and "when to stop and ask the user".
- If content grows large, move details into \`reference.md\` / \`examples.md\` and keep SKILL.md concise (ideally < 500 lines).

## Step 4: Generate Files (Persist)
Use \`createArtifact\` to create the skill (fill in description + content in one go):

\`\`\`
createArtifact({
  type: "skill",
  name: "<skill-name>",
  description: "<Third-person description; include triggers and scenarios>",
  content: "<Full SKILL.md content>"
})
\`\`\`

## Step 5: Deliver and Verify
Finish by telling the user:
1. The skill name and path
2. How it triggers (keywords/scenarios)
3. One minimal "how to test" example input

# IMPORTANT RULES
- The description MUST say "when to use" it (trigger terms/scenarios), otherwise the skill will be hard to discover.
- Do not write long generic tutorials; only include instructions that change agent behavior.
- If a decision depends on user preference or missing context: use \`askQuestion\` instead of guessing.
- Never ask for secrets to be written into the repo; secrets must be configured securely.

# EDGE CASES
- The user actually needs a one-shot prompt template (command), not a skill: redirect to \`create-command\`.
- Multiple independent workflows are requested: split into multiple skills, or a main skill plus smaller skills.
- Name conflicts / an existing skill already uses the name: rename or clarify the difference in the description.
- The user requests overwrite/delete but does not confirm the exact path: stop and ask for confirmation.

# TEMPLATE
The canonical path is: \`obsidian-agent/skills/<skill-name>/SKILL.md\`.`,
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
