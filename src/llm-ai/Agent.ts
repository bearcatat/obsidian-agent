import { generateText, ModelMessage, ToolLoopAgent } from "ai";
import Streamer from "./Streamer";
import { UserMessage } from "@/messages/user-message";
import { TFile } from "obsidian";
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
        activeNote: TFile | null,
        contextNotes: TFile[],
        abortController: AbortController,
        addMessage: (message: MessageV2) => void
    ) {
        const systemPrompts = await getSystemPrompts();

        const agent = new ToolLoopAgent({
            ...AIModelManager.getInstance().agentConfig,
            instructions: systemPrompts[0],
            tools: AIToolManager.getInstance().getMainAgentEnabledTools(),
            toolChoice: 'auto',
            experimental_context: {
                addMessage: addMessage
            },
        })

        const enhancedMessage = this.getFullUserMessage(message, activeNote, contextNotes)
        this.messages.push(enhancedMessage.toModelMessage())
        const streamer = new Streamer(agent, addMessage)
        const result = await streamer.stream(this.messages, abortController.signal)
        const messages = (await result.response).messages
        this.messages.push(...messages)
        console.log(this.messages)
    }

    getFullUserMessage(message: UserMessage, activeNote: TFile | null, contextNotes: TFile[]): UserMessage {
        const contextInfo = [];

        if (activeNote) {
            contextInfo.push(`📄 当前活动笔记: ${activeNote.path}`);
        }

        if (contextNotes.length > 0) {
            const contextPaths = contextNotes.map(note => note.path).join(' | ');
            contextInfo.push(`📚 相关上下文笔记: ${contextPaths}`);
        }

        const enhancedContent = contextInfo.length > 0
            ? `## 上下文信息\n${contextInfo.join('\n')}\n\n## 用户消息\n${message.content}`
            : message.content;

        return new UserMessage(enhancedContent);
    }

    async generateTitle(userMessage: string): Promise<string> {
        const messages: Array<ModelMessage> = [
            {
                role: "system",
                content: getTitleGenerationPrompt()
            },
            {
                role: "user",
                content: userMessage
            },
        ]
        try {
            const { text } = await generateText({
                ...AIModelManager.getInstance().agentConfig,
                messages: messages,
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