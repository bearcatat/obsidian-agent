import { SettingsState } from "@/state/settings-state-impl";
import { ModelMessage, tool, ToolLoopAgent, ToolSet, UserModelMessage } from "ai";
import DeepSeekGenerator from "./models/deepseek";
import { z } from 'zod';
import { convertDateToTimeInfo } from "@/tools/Time/common/common";
import Streamer from "./Streamer";
import { UserMessage } from "@/messages/user-message";
import { TFile } from "obsidian";
import { getSystemPrompts, getTitleGenerationPrompt } from "./system-prompts";
import AIToolManager from "@/tool-ai/ToolManager";




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

    async query(message: UserMessage, activeNote: TFile | null, contextNotes: TFile[], abortController: AbortController) {
        const modelConfig = SettingsState.getInstance().defaultAgentModel
        if (!modelConfig) {
            console.log("modelConfig is null")
            return
        }
        const deepSeekModel = DeepSeekGenerator.getInstance().newModel(modelConfig)
        const systemPrompts = await getSystemPrompts();

        const agent = new ToolLoopAgent({
            model: deepSeekModel.getModel(),
            instructions: systemPrompts[0],
            tools: AIToolManager.getInstance().getMainAgentEnabledTools(),
            toolChoice: 'auto'
        })

        const enhancedMessage = this.getFullUserMessage(message, activeNote, contextNotes)
        this.messages.push(enhancedMessage.toModelMessage())
        const streamer = new Streamer(agent)
        const messages = await streamer.stream(this.messages, abortController)
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
        const modelConfig = SettingsState.getInstance().defaultAgentModel
        if (!modelConfig) {
            console.log("modelConfig is null")
            return ""
        }
        const deepSeekModel = DeepSeekGenerator.getInstance().newModel(modelConfig)
        const titleSystemPrompt: ModelMessage = {
            role: "system",
            content: getTitleGenerationPrompt()
        }
        const userSystemPrompt: ModelMessage = {
            role: "user",
            content: userMessage
        }
        const messages: Array<ModelMessage> = [
            titleSystemPrompt,
            userSystemPrompt,
        ]
        try {
            const text = await deepSeekModel.generateText(messages, {}, new AbortController, () => { })
            return text

        } catch (error) {
            return ""
        }
    }

    async clearMemory(): Promise<void> {
        this.messages = new Array<ModelMessage>()
    }
}