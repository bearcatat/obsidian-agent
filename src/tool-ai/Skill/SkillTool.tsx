import { tool } from "ai";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { MessageV2 } from "@/types";
import SkillLogic from "@/logic/skill-logic";

export const toolName = "skill";

// 动态生成描述，包含可用技能列表
function getSkillDescription(): string {
  const skillLogic = SkillLogic.getInstance();
  const skills = skillLogic.getSkills();
  
  let skillList = '';
  if (skills.length > 0) {
    skillList = skills.map(s => `  - ${s.name}: ${s.description}`).join('\n');
  } else {
    skillList = '  (No skills available)';
  }
  
  return `Load a skill (SKILL.md file) and return its content in the conversation.

Skills are reusable instructions stored in obsidian-agent/skills/<name>/SKILL.md.

When to use this tool:
- When you need specialized knowledge or instructions for a specific task
- When the user asks about a topic covered by an available skill
- When you need to follow specific guidelines defined in a skill

The skill will be activated for the current session, meaning its content will be
available for all subsequent messages in this conversation.

Available skills:
${skillList}

To load a skill, call this tool with the skill name. The skill content will be
returned and activated for this session.

Note: Skills loaded via this tool remain active for the entire session.`;
}

export const SkillTool = tool({
  title: toolName,
  description: getSkillDescription(),
  inputSchema: z.object({
    name: z.string().describe("The name of the skill to load"),
  }),
  execute: async ({ name }, { toolCallId, experimental_context }) => {
    const context = experimental_context as { addMessage: (message: MessageV2) => void };
    
    try {
      const toolMessage = ToolMessage.from(toolName, toolCallId);
      const skillLogic = SkillLogic.getInstance();
      
      // 查找 skill
      const skill = skillLogic.getSkillByName(name);
      
      if (!skill) {
        const errorResult = {
          error: "Skill not found",
          message: `Skill "${name}" does not exist`,
          available_skills: skillLogic.getSkills().map(s => ({ name: s.name, description: s.description })),
        };
        
        toolMessage.setContent(JSON.stringify(errorResult));
        context.addMessage(toolMessage);
        return JSON.stringify(errorResult);
      }
      
      // 将会话级 skill 激活
      skillLogic.activateSessionSkill(name);
      
      const result = {
        success: true,
        name: skill.name,
        description: skill.description,
        content: skill.body,
        message: `Skill "${name}" loaded and activated for this session`,
      };
      
      toolMessage.setChildren(renderSkillMessage(result));
      context.addMessage(toolMessage);
      
      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error);
      context.addMessage(errorMessage);
      throw error;
    }
  }
});

export function renderSkillMessage(result: { success: boolean; name: string; description: string; content: string; message: string }): React.ReactNode {
  return `use ${result.name}`;
}