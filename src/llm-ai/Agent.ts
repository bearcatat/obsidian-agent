import { generateText, ModelMessage, ToolLoopAgent, ToolSet } from "ai";
import Streamer from "./Streamer";
import { UserMessage } from "@/messages/user-message";
import { getSystemPrompts, getTitleGenerationPrompt } from "./system-prompts";
import AIToolManager from "@/tool-ai/ToolManager";
import { MessageV2 } from "@/types";
import AIModelManager from "./ModelManager";
import SkillLogic from "@/logic/skill-logic";
import { CHAT_TITLE_MAX_LENGTH } from "./title-constants";

export default class AIAgent {
    private static instance: AIAgent

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

    private buildSystemPrompt(): string {
        const basePrompt = getSystemPrompts()[0];
        const skillLogic = SkillLogic.getInstance();
        const activeSkills = skillLogic.getActiveSkillsForSession();
        
        if (activeSkills.length === 0) {
            return basePrompt;
        }
        
        // 构建 skills 部分
        const skillsContent = activeSkills.map(skill => {
            return `## Skill: ${skill.name}\n${skill.description}\n\n${skill.body}`;
        }).join('\n\n---\n\n');
        
        return `${basePrompt}\n\n# Active Skills\n\nThe following skills are active for this conversation:\n\n${skillsContent}`;
    }

    async query(message: UserMessage,
        history: ModelMessage[],
        abortController: AbortController,
        addMessage: (message: MessageV2) => void
    ): Promise<ModelMessage[]> {
        const modelManager = AIModelManager.getInstance();
        const agentConfig = modelManager.getAgentConfig();
        const userTools = AIToolManager.getInstance().getMainAgentEnabledTools();
        const builtinTools = agentConfig.tools;
        const mergedTools = this.mergeTools(userTools, builtinTools);

        const agent = new ToolLoopAgent({
            ...agentConfig,
            instructions: this.buildSystemPrompt(),
            tools: mergedTools,
            toolChoice: 'auto',
            experimental_context: {
                addMessage: addMessage
            },
            maxRetries: 3,
            stopWhen: []
        })
        const rawHistory = [...history, message.toModelMessage()];
        const newHistory = modelManager.normalizeMessages(rawHistory);
        const streamer = new Streamer(agent, addMessage)
        const result = await streamer.stream(newHistory, abortController.signal)
        const messages = (await result.response).messages
        return [...newHistory, ...messages];
    }


    async generateTitle(userMessage: string): Promise<string> {
        try {
            const titleConfig = AIModelManager.getInstance().getTitleConfig();
            const { text } = await generateText({
                system: getTitleGenerationPrompt(),
                ...titleConfig,
                messages: [
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                maxRetries: 3,
            })
            return text.substring(0, CHAT_TITLE_MAX_LENGTH)
        } catch (error) {
            return ""
        }
    }

    async clearMemory(): Promise<void> {
        // 清除会话级激活的技能，避免影响新对话
        SkillLogic.getInstance().clearSessionSkills()
    }
}