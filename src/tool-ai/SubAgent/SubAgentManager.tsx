import SubAgent from "@/llm-ai/SubAgent";
import { ToolMessage } from "@/messages/tool-message";
import { UserMessage } from "@/messages/user-message";
import { SettingsState } from "@/state/settings-state-impl";
import { MessageV2, ModelConfig, SubAgentConfig } from "@/types";
import { SubAgentMessagesCard } from "@/ui/components/agent-view/messages/messages";
import { tool, ToolSet } from "ai";
import { z } from 'zod';


export default class SubAgentManager {
  private subAgentConfigs: SubAgentConfig[] = [];

  updateSubAgents(subAgents: SubAgentConfig[]) {
    this.subAgentConfigs = subAgents;
  }

  getEnabledTools(allToolSet: ToolSet): ToolSet {
    const enableSubAgents = this.subAgentConfigs.filter(subAgent => subAgent.enabled)
    if (enableSubAgents.length === 0) {
      return {};
    }
    const toolSet: ToolSet = {}
    enableSubAgents.forEach(config => {
      const agentTool = tool({
        title: config.name,
        description: config.description,
        inputSchema: z.object({
          message: z.string().describe("The message to send to the sub agent, should include context information"),
        }),
        execute: async ({ message }, { toolCallId, experimental_context, abortSignal }) => {
          const context = experimental_context as { addMessage: (message: MessageV2) => void }
          const userMessage = new UserMessage(message)

          let messages: MessageV2[] = [userMessage];
          const toolMessage = ToolMessage.from(config.name, toolCallId)
          toolMessage.setChildren(render(messages));
          context.addMessage(toolMessage)

          const modelConfig = getModelConfig(config.modelId);
          if (!modelConfig) {
            throw new Error(`Model with ID "${config.modelId}" not found`);
          }

          const agent = new SubAgent(config.name, config.systemPrompt, config.description, modelConfig)
          agent.setTools(getToolSetForSubAgent(config, allToolSet))

          // Todo Tools
          const text = await agent.query(userMessage, abortSignal ?? new AbortController().signal, (message: MessageV2) => {
            messages = [...messages, message];
            toolMessage.setChildren(render(messages));
            context.addMessage(toolMessage)
          })
          return text
        }
      })
      toolSet[config.name] = agentTool
    })
    return toolSet
  }
}

function render(messages: MessageV2[]): React.ReactNode {
  const messagesOnlyWithTools = messages.filter((message: MessageV2) => message.role === "tool");
  return (
    <SubAgentMessagesCard messages={messagesOnlyWithTools} />
  )
}

function getModelConfig(modelId: string): ModelConfig | null {
  const settingsState = SettingsState.getInstance();
  const models = settingsState.models;
  return models.find(model => model.id === modelId) || null;
}

function getToolSetForSubAgent(config: SubAgentConfig, toolSet: ToolSet): ToolSet {
  const enabledToolNames = config.tools.filter(tool => tool.enabled).map(tool => tool.name);
  return Object.fromEntries(Object.entries(toolSet).filter(([k, v]) => enabledToolNames.includes(k)))
}
