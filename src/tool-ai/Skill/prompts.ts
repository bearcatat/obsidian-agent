export const DESCRIPTION = `Load a skill (SKILL.md file) and return its content in the conversation.

Skills are reusable instructions stored in obsidian-agent/skills/<name>/SKILL.md.

When to use this tool:
- When you need specialized knowledge or instructions for a specific task
- When the user asks about a topic covered by an available skill
- When you need to follow specific guidelines defined in a skill

The skill will be activated for the current session, meaning its content will be
available for all subsequent messages in this conversation.

Available skills:
<available_skills>
  {{SKILL_LIST}}
</available_skills>

To load a skill, call this tool with the skill name. The skill content will be
returned and activated for this session.

Note: Skills loaded via this tool remain active for the entire session. To disable
a skill for the current session, the user can use /disable_skill <skill-name>.`;