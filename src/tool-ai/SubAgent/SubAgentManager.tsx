import SubAgent from "@/llm-ai/SubAgent";
import { ToolMessage } from "@/messages/tool-message";
import { UserMessage } from "@/messages/user-message";
import { MessageV2, SubAgentConfig } from "@/types";
import { SubAgentMessagesCard } from "@/ui/components/agent-view/messages/messages";
import { tool, ToolSet } from "ai";
import { z } from 'zod';
import SubAgentLogic from "@/logic/subagent-logic";
import RuleLogic from "@/logic/rule-logic";
import AIModelManager from "@/llm-ai/ModelManager";
import { agentStore } from "@/state/agent-state-impl";
import {
  TASK_SUBAGENT_DESCRIPTION,
  TASK_SUBAGENT_DESCRIPTION_PARAMETER_DESCRIPTION,
  TASK_SUBAGENT_NAME,
  TASK_SUBAGENT_SYSTEM_PROMPT,
} from "./prompts";


export default class SubAgentManager {
  updateSubAgents() {
  }

  getEnabledTools(allToolSet: ToolSet): ToolSet {
    const enabledSubAgents = SubAgentLogic.getInstance().getEnabledSubAgents();

    const modelManager = AIModelManager.getInstance();
    // Check if default model is configured
    if (!modelManager.agentModelConfig) {
      console.warn('SubAgentManager: No default agent model configured');
      return {};
    }

    const toolSet: ToolSet = {}
    enabledSubAgents.forEach(config => {
      const agentTool = tool({
        title: config.name,
        description: config.description,
        inputSchema: z.object({
          message: z.string().describe("The message to send to the sub agent, should include context information"),
        }),
        execute: async ({ message }, { toolCallId, experimental_context, abortSignal }) => {
          return this.runSubAgentTool(
            config,
            message,
            getToolSetForSubAgent(config, allToolSet),
            toolCallId,
            experimental_context,
            abortSignal ?? new AbortController().signal,
          );
        }
      })
      toolSet[config.name] = agentTool
    })

    if (toolSet[TASK_SUBAGENT_NAME]) {
      console.warn(`SubAgentManager: Built-in subagent "${TASK_SUBAGENT_NAME}" overrides file-based subagent with the same name`);
    }

    toolSet[TASK_SUBAGENT_NAME] = tool({
      title: TASK_SUBAGENT_NAME,
      description: TASK_SUBAGENT_DESCRIPTION,
      inputSchema: z.object({
        description: z.string().describe(TASK_SUBAGENT_DESCRIPTION_PARAMETER_DESCRIPTION),
      }),
      execute: async ({ description }, { toolCallId, experimental_context, abortSignal }) => {
        return this.runSubAgentTool(
          {
            name: TASK_SUBAGENT_NAME,
            description: TASK_SUBAGENT_DESCRIPTION,
            systemPrompt: TASK_SUBAGENT_SYSTEM_PROMPT,
            enabled: true,
            filePath: "",
            builtin: true,
          },
          description,
          getToolSetForTaskSubAgent(allToolSet),
          toolCallId,
          experimental_context,
          abortSignal ?? new AbortController().signal,
        );
      }
    })

    return toolSet
  }

  private async runSubAgentTool(
    config: SubAgentConfig,
    prompt: string,
    toolSet: ToolSet,
    toolCallId: string,
    experimentalContext: unknown,
    abortSignal: AbortSignal,
  ): Promise<string> {
    const modelManager = AIModelManager.getInstance();
    const currentModel = agentStore.getState().model;
    const currentVariant = agentStore.getState().variant;
    const agentModelConfig = currentModel ?? modelManager.agentModelConfig;
    const agentVariant = currentVariant ?? modelManager.currentVariant ?? null;

    if (!agentModelConfig) {
      throw new Error('No model configured for SubAgent');
    }

    const context = experimentalContext as { addMessage: (message: MessageV2) => void }
    const userMessage = new UserMessage(prompt)

    let messages: MessageV2[] = [userMessage];
    const toolMessage = ToolMessage.from(config.name, toolCallId)
    toolMessage.setChildren(render(config.name, messages, true));
    context.addMessage(toolMessage)

    const agent = new SubAgent(
      config.name,
      buildSubAgentSystemPrompt(config),
      config.description,
      agentModelConfig,
      agentVariant,
    )
    agent.setTools(toolSet)

    const text = await agent.query(userMessage, abortSignal, (message: MessageV2) => {
      const existingIndex = messages.findIndex((m) => m.id === message.id);

      if (existingIndex >= 0) {
        const newMessages = [...messages];
        newMessages[existingIndex] = message;
        messages = newMessages;
      } else {
        messages = [...messages, message];
      }

      toolMessage.setChildren(render(config.name, messages, true));
      context.addMessage(toolMessage)
    })
    toolMessage.setChildren(render(config.name, messages, false));
    toolMessage.close()
    return text
  }
}

function render(name: string, messages: MessageV2[], isStreaming: boolean): React.ReactNode {
  return (
    <SubAgentMessagesCard name={name} messages={messages} isStreaming={isStreaming} />
  )
}

function getToolSetForSubAgent(config: SubAgentConfig, toolSet: ToolSet): ToolSet {
  if (!config.tools || config.tools.length === 0) {
    return {};
  }
  return Object.fromEntries(Object.entries(toolSet).filter(([toolName]) => config.tools!.includes(toolName)))
}

function getToolSetForTaskSubAgent(toolSet: ToolSet): ToolSet {
  return Object.fromEntries(
    Object.entries(toolSet).filter(([toolName]) => toolName !== TASK_SUBAGENT_NAME && toolName !== "skill")
  )
}

function buildSubAgentSystemPrompt(config: SubAgentConfig): string {
  const subAgentRules = RuleLogic.getInstance().getRulesForSubAgent();
  if (subAgentRules.length === 0) {
    return config.systemPrompt;
  }

  const rulesContent = subAgentRules.map(rule => {
    return `## Rule: ${rule.name}\n${rule.body}`;
  }).join('\n\n---\n\n');

  return `${config.systemPrompt}\n\n# Rules\n\nThe following rules must be followed at all times:\n\n${rulesContent}`;
}
