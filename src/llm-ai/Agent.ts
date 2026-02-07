import { generateText, ModelMessage, ToolLoopAgent } from "ai";
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

    async query(message: UserMessage,
        abortController: AbortController,
        addMessage: (message: MessageV2) => void
    ) {
        console.log(AIModelManager.getInstance().agentConfig)
        const agent = new ToolLoopAgent({
            ...AIModelManager.getInstance().agentConfig,
            instructions: getSystemPrompts()[0],
            tools: AIToolManager.getInstance().getMainAgentEnabledTools(),
            toolChoice: 'auto',
            experimental_context: {
                addMessage: addMessage
            },
            maxRetries: 3,
        })
        this.messages.push(message.toModelMessage())
        const streamer = new Streamer(agent, addMessage)
        const result = await streamer.stream(this.messages, abortController.signal)
        const messages = (await result.response).messages
        this.messages.push(...messages)
        console.log(this.messages)
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