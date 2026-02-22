import SubAgent from "@/llm-ai/SubAgent";
import { ToolMessage } from "@/messages/tool-message";
import { UserMessage } from "@/messages/user-message";
import { MessageV2, SubAgentConfig } from "@/types";
import { SubAgentMessagesCard } from "@/ui/components/agent-view/messages/messages";
import { tool, ToolSet } from "ai";
import { z } from 'zod';
import SubAgentLogic from "@/logic/subagent-logic";
import AIModelManager from "@/llm-ai/ModelManager";


export default class SubAgentManager {
  updateSubAgents() {
  }

  getEnabledTools(allToolSet: ToolSet): ToolSet {
    const enabledSubAgents = SubAgentLogic.getInstance().getEnabledSubAgents();
    if (enabledSubAgents.length === 0) {
      return {};
    }

    const modelManager = AIModelManager.getInstance();
    const agentModelConfig = modelManager.agentModelConfig;

    if (!agentModelConfig) {
      console.warn('SubAgentManager: No agent model configured');
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
          const context = experimental_context as { addMessage: (message: MessageV2) => void }
          const userMessage = new UserMessage(message)

          let messages: MessageV2[] = [userMessage];
          const toolMessage = ToolMessage.from(config.name, toolCallId)
            toolMessage.setChildren(render(config.name, messages));
            context.addMessage(toolMessage)

          const agent = new SubAgent(config.name, config.systemPrompt, config.description, agentModelConfig)
          agent.setTools(getToolSetForSubAgent(config, allToolSet))

          const text = await agent.query(userMessage, abortSignal ?? new AbortController().signal, (message: MessageV2) => {
            const lastMessage = messages[messages.length - 1];
            // 优化流式消息处理：移除之前的流式消息，如果消息id相同
            if (lastMessage && lastMessage.id === message.id) {
              messages.pop();
            }
            messages = [...messages, message];
            
          toolMessage.setChildren(render(config.name, messages));
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

function render(name: string, messages: MessageV2[]): React.ReactNode {
  // const messagesOnlyWithTools = messages.filter((message: MessageV2) => message.role === "tool");
  return (
    <SubAgentMessagesCard name={name} messages={messages} />
  )
}

function getToolSetForSubAgent(config: SubAgentConfig, toolSet: ToolSet): ToolSet {
  if (!config.tools || config.tools.length === 0) {
    return {};
  }
  return Object.fromEntries(Object.entries(toolSet).filter(([k, v]) => config.tools!.includes(k)))
}
