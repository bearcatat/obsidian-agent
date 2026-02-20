import { generateText, ModelMessage, ToolLoopAgent, ToolSet } from "ai";
import Streamer from "./Streamer";
import { UserMessage } from "@/messages/user-message";
import { getSystemPrompts, getTitleGenerationPrompt } from "./system-prompts";
import AIToolManager from "@/tool-ai/ToolManager";
import { MessageV2 } from "@/types";
import AIModelManager from "./ModelManager";

export default class AIAgent {
    private static instance: AIAgent
    private messages: Array<ModelMessage> = new Array<ModelMessage>();

    static getInstance(): AIAgent {
        if (!AIAgent.instance) {
            AIAgent.instance = new AIAgent();
        }
        return AIAgent.instance;
    }

    static resetInstance(): void {
        AIAgent.instance = undefined as any;
    }

    private mergeTools(userTools: ToolSet, builtinTools: ToolSet | undefined): ToolSet {
        if (!builtinTools) {
            return userTools;
        }

        const mergedTools = { ...userTools };

        for (const [toolName, tool] of Object.entries(builtinTools)) {
            if (mergedTools[toolName]) {
                console.warn(`[Agent] 内置工具 "${toolName}" 已覆盖用户自定义工具`);
            }
            mergedTools[toolName] = tool;
        }

        return mergedTools;
    }

    async query(message: UserMessage,
        abortController: AbortController,
        addMessage: (message: MessageV2) => void
    ) {
        const modelManager = AIModelManager.getInstance();
        const userTools = AIToolManager.getInstance().getMainAgentEnabledTools();
        const builtinTools = modelManager.agentConfig.tools;
        const mergedTools = this.mergeTools(userTools, builtinTools);

        const agent = new ToolLoopAgent({
            ...modelManager.agentConfig,
            instructions: getSystemPrompts()[0],
            tools: mergedTools,
            toolChoice: 'auto',
            experimental_context: {
                addMessage: addMessage
            },
            maxRetries: 3,
        })
        this.messages.push(message.toModelMessage())
        const streamer = new Streamer(agent, addMessage)
        if (!modelManager.agentModelConfig.useCORS) {
            const result = await streamer.stream(this.messages, abortController.signal)
            const messages = (await result.response).messages
            this.messages.push(...messages)
        } else {
            const result = await streamer.generate(this.messages, abortController.signal)
            const messages = (await result.response).messages
            this.messages.push(...messages)
        }
    }


    async generateTitle(userMessage: string): Promise<string> {
        try {
            const { text } = await generateText({
                system: getTitleGenerationPrompt(),
                ...AIModelManager.getInstance().titleConfig,
                messages: [
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                maxRetries: 3,
            })
            return text
        } catch (error) {
            return ""
        }
    }

    async clearMemory(): Promise<void> {
        this.messages = new Array<ModelMessage>()
    }
}