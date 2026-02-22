import { tool } from "ai";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { MessageV2 } from "@/types";
import { isBuiltinCommand } from "@/logic/builtin-commands";
import { isBuiltinSkill } from "@/logic/builtin-skills";
import CommandLogic from "@/logic/command-logic";
import SkillLogic from "@/logic/skill-logic";
import SubAgentLogic from "@/logic/subagent-logic";
import AIToolManager from "@/tool-ai/ToolManager";

export const toolName = "createArtifact";

type ArtifactType = "command" | "skill" | "subagent";

interface CreateArtifactResult {
  type: ArtifactType;
  name: string;
  description: string;
  file_path: string;
  is_new_file: boolean;
  content: string;
}

function formatCommandFile(name: string, description: string, template: string): string {
  return `---
name: ${name}
description: ${description}
---
${template}`;
}

function formatSkillFile(
  name: string, 
  description: string, 
  body: string,
  license?: string,
  compatibility?: string,
  metadata?: Record<string, string>
): string {
  let frontmatter = `---\nname: ${name}\ndescription: ${description}`;
  
  if (license) {
    frontmatter += `\nlicense: ${license}`;
  }
  
  if (compatibility) {
    frontmatter += `\ncompatibility: ${compatibility}`;
  }
  
  if (metadata && Object.keys(metadata).length > 0) {
    frontmatter += '\nmetadata:';
    for (const [key, value] of Object.entries(metadata)) {
      frontmatter += `\n  ${key}: ${value}`;
    }
  }
  
  frontmatter += '\n---\n\n';
  
  return frontmatter + body;
}

function formatSubAgentFile(
  name: string,
  description: string,
  systemPrompt: string,
  tools?: string[]
): string {
  let frontmatter = `---\nname: ${name}\ndescription: ${description}`;
  
  if (tools && tools.length > 0) {
    frontmatter += '\ntools:';
    for (const tool of tools) {
      frontmatter += `\n  - ${tool}`;
    }
  }
  
  frontmatter += '\n---\n\n';
  
  return frontmatter + systemPrompt;
}

export const CreateArtifactTool = tool({
  title: toolName,
  description: `Create a new artifact (command, skill, or subagent file).

This tool creates:
1. A command file in obsidian-agent/commands/{name}.md
2. A skill file in obsidian-agent/skills/{name}/SKILL.md
3. A subagent file in obsidian-agent/subagents/{name}/AGENT.md

Commands:
- Can be triggered with /{name}
- Use lowercase with underscores (e.g., "translate_text")
- Support $ARGUMENTS and $1, $2, etc. for variable substitution

Skills:
- Can be loaded on-demand via the skill tool
- Use lowercase with hyphens (e.g., "translate-text")
- Follow OpenCode SKILL.md format with frontmatter
- Support license, compatibility, and metadata fields

SubAgents:
- Specialized AI agents with custom system prompts
- Use lowercase with hyphens (e.g., "code-reviewer")
- SubAgents use the same model as the main agent
- Optionally specify allowed tools

The tool will:
1. Validate the artifact name according to type-specific rules
2. Check for existing artifacts with the same name
3. Create the file with proper format
4. Reload the appropriate logic to make it available immediately`,
  inputSchema: z.object({
    type: z.enum(["command", "skill", "subagent"]).describe("Type of artifact to create"),
    name: z.string().describe("Artifact name (commands: lowercase with underscores; skills/subagents: lowercase with hyphens)"),
    description: z.string().describe("Brief description of what the artifact does"),
    content: z.string().describe("The content body (command template, skill instructions, or subagent system prompt)"),
    license: z.string().optional().describe("Optional license (for skills only)"),
    compatibility: z.string().optional().describe("Optional compatibility info (for skills only)"),
    metadata: z.record(z.string()).optional().describe("Optional metadata as key-value pairs (for skills only)"),
    tools: z.array(z.string()).optional().describe("Optional list of allowed tool names (for subagents)"),
  }),
  execute: async ({ type, name, description, content, license, compatibility, metadata, tools }, { toolCallId, experimental_context }) => {
    const context = experimental_context as { addMessage: (message: MessageV2) => void };
    
    try {
      const toolMessage = ToolMessage.from(toolName, toolCallId);
      const app = getGlobalApp();
      const vault = app.vault;

      let artifactName: string;
      let filePath: string;
      let fileContent: string;
      let isNewFile: boolean;

      if (type === "command") {
        artifactName = name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        
        if (!artifactName) {
          toolMessage.setContent(JSON.stringify({
            error: "Invalid command name",
            message: "Command name must contain at least one alphanumeric character",
          }));
          context.addMessage(toolMessage);
          return JSON.stringify({ error: "Invalid command name" });
        }

        if (isBuiltinCommand(artifactName) || isBuiltinSkill(artifactName)) {
          toolMessage.setContent(JSON.stringify({
            error: "Reserved name",
            message: `"${artifactName}" is a reserved name and cannot be used`,
          }));
          context.addMessage(toolMessage);
          return JSON.stringify({ error: "Reserved name" });
        }

        const existingCommands = CommandLogic.getInstance().getCommands();
        const existingCommand = existingCommands.find(cmd => cmd.name === artifactName);
        isNewFile = !existingCommand;

        filePath = `obsidian-agent/commands/${artifactName}.md`;
        fileContent = formatCommandFile(artifactName, description, content);
      } else if (type === "skill") {
        const validation = SkillLogic.validateSkillName(name.trim());
        if (!validation.valid) {
          toolMessage.setContent(JSON.stringify({
            error: "Invalid skill name",
            message: validation.error,
          }));
          context.addMessage(toolMessage);
          return JSON.stringify({ error: "Invalid skill name" });
        }
        
        artifactName = name.trim();
        
        if (isBuiltinSkill(artifactName)) {
          toolMessage.setContent(JSON.stringify({
            error: "Reserved name",
            message: `"${artifactName}" is a reserved skill name and cannot be used`,
          }));
          context.addMessage(toolMessage);
          return JSON.stringify({ error: "Reserved name" });
        }
        
        const existingSkill = SkillLogic.getInstance().getSkillByName(artifactName);
        isNewFile = !existingSkill;

        filePath = `obsidian-agent/skills/${artifactName}/SKILL.md`;
        fileContent = formatSkillFile(artifactName, description, content, license, compatibility, metadata);
      } else {
        const validation = SubAgentLogic.validateSubAgentName(name.trim());
        if (!validation.valid) {
          toolMessage.setContent(JSON.stringify({
            error: "Invalid subagent name",
            message: validation.error,
          }));
          context.addMessage(toolMessage);
          return JSON.stringify({ error: "Invalid subagent name" });
        }
        
        artifactName = name.trim();
        
        const existingSubAgent = SubAgentLogic.getInstance().getSubAgentByName(artifactName);
        isNewFile = !existingSubAgent;

        filePath = `obsidian-agent/subagents/${artifactName}/AGENT.md`;
        fileContent = formatSubAgentFile(artifactName, description, content, tools);
      }

      const result: CreateArtifactResult = {
        type,
        name: artifactName,
        description,
        file_path: filePath,
        is_new_file: isNewFile,
        content: fileContent,
      };

      let resolver: (value: "apply" | "reject") => void;
      const waitForDecision = () => new Promise<"apply" | "reject">((resolve) => { resolver = resolve; });
      const handleApply = () => { resolver("apply"); };
      const handleReject = () => { resolver("reject"); };

      toolMessage.setChildren(render(result, false, null, handleApply, handleReject));
      context.addMessage(toolMessage);

      const decision = await waitForDecision();

      if (decision === "apply") {
        try {
          if (type === "command") {
            const dirPath = 'obsidian-agent/commands';
            const dirExists = await vault.adapter.exists(dirPath);
            if (!dirExists) {
              await vault.adapter.mkdir(dirPath);
            }

            const file = vault.getAbstractFileByPath(filePath);
            if (file) {
              await vault.modify(file as any, fileContent);
            } else {
              await vault.create(filePath, fileContent);
            }

            await CommandLogic.getInstance().loadCommands();
          } else if (type === "skill") {
            const dirPath = `obsidian-agent/skills/${artifactName}`;
            const dirExists = await vault.adapter.exists(dirPath);
            if (!dirExists) {
              await vault.adapter.mkdir(dirPath);
            }

            const file = vault.getAbstractFileByPath(filePath);
            if (file) {
              await vault.modify(file as any, fileContent);
            } else {
              await vault.create(filePath, fileContent);
            }

            await SkillLogic.getInstance().loadSkills();
          } else {
            const dirPath = `obsidian-agent/subagents/${artifactName}`;
            const dirExists = await vault.adapter.exists(dirPath);
            if (!dirExists) {
              await vault.adapter.mkdir(dirPath);
            }

            const file = vault.getAbstractFileByPath(filePath);
            if (file) {
              await vault.modify(file as any, fileContent);
            } else {
              await vault.create(filePath, fileContent);
            }

            await SubAgentLogic.getInstance().loadSubAgents();
            await AIToolManager.getInstance().updateSubAgents();
          }
        } catch (error) {
          toolMessage.setContent(JSON.stringify({
            error: `Failed to create ${type}`,
            details: error instanceof Error ? error.message : "unknown error",
          }));
          context.addMessage(toolMessage);
          return JSON.stringify({ error: `Failed to create ${type}` });
        }
      } else {
        toolMessage.setContent(JSON.stringify({
          cancelled: true,
          message: `User rejected the ${type} creation`,
        }));
      }

      toolMessage.setChildren(render(result, true, decision, handleApply, handleReject));
      toolMessage.close();
      context.addMessage(toolMessage);

      const typeLabel = type === "command" ? "Command" : type === "skill" ? "Skill" : "SubAgent";
      return JSON.stringify({
        success: decision === "apply",
        type,
        name: artifactName,
        file_path: filePath,
        message: decision === "apply" 
          ? `${typeLabel} "${artifactName}" ${isNewFile ? "created" : "updated"} successfully`
          : "User rejected",
      });
    } catch (error) {
      const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error);
      context.addMessage(errorMessage);
      throw error;
    }
  }
});

function render(
  result: CreateArtifactResult,
  answered: boolean,
  decision: "apply" | "reject" | null,
  onApply: () => void,
  onReject: () => void
): React.ReactNode {
  const typeLabel = result.type === "command" ? "Command" : result.type === "skill" ? "Skill" : "SubAgent";
  const icon = result.type === "command" ? "📝" : result.type === "skill" ? "🎯" : "🤖";
  const triggerLabel = result.type === "command" 
    ? `/${result.name}` 
    : result.type === "skill" 
      ? `skill({ name: "${result.name}" })`
      : `${result.name}()`;
  
  return (
    <div className="tw-p-3 tw-border tw-rounded-lg tw-bg-muted/30">
      <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
        <span className="tw-text-lg">{icon}</span>
        <span className="tw-font-medium">
          {result.is_new_file ? `Create ${typeLabel}` : `Update ${typeLabel}`}
        </span>
        {answered && (
          <span className={`tw-ml-auto tw-text-sm ${decision === 'apply' ? 'tw-text-green-600' : 'tw-text-red-600'}`}>
            {decision === 'apply' ? '✓ Applied' : '✗ Rejected'}
          </span>
        )}
      </div>
      
      <div className="tw-space-y-1 tw-text-sm tw-mb-3">
        <div>
          <span className="tw-text-muted-foreground">Type:</span>{' '}
          <span className="tw-capitalize">{result.type}</span>
        </div>
        <div>
          <span className="tw-text-muted-foreground">{typeLabel}:</span>{' '}
          <code className="tw-px-1 tw-bg-muted tw-rounded">{triggerLabel}</code>
        </div>
        <div>
          <span className="tw-text-muted-foreground">Description:</span> {result.description}
        </div>
        <div>
          <span className="tw-text-muted-foreground">File:</span>{' '}
          <code className="tw-px-1 tw-bg-muted tw-rounded tw-text-xs">{result.file_path}</code>
        </div>
      </div>

      <details className="tw-mb-3">
        <summary className="tw-cursor-pointer tw-text-sm tw-text-muted-foreground hover:tw-text-normal">
          Preview content
        </summary>
        <pre className="tw-mt-2 tw-p-2 tw-bg-muted tw-rounded tw-text-xs tw-overflow-x-auto tw-whitespace-pre-wrap">
          {result.content}
        </pre>
      </details>

      {!answered && (
        <div className="tw-flex tw-gap-2 tw-justify-end">
          <button
            onClick={onReject}
            className="tw-px-3 tw-py-1 tw-text-sm tw-rounded tw-bg-destructive tw-text-on-accent hover:tw-opacity-80"
          >
            Reject
          </button>
          <button
            onClick={onApply}
            className="tw-px-3 tw-py-1 tw-text-sm tw-rounded tw-bg-interactive-accent tw-text-on-accent hover:tw-opacity-80"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
