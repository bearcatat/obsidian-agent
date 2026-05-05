import { generateText, ModelMessage } from "ai";
import { UserMessage } from "@/messages/user-message";
import { getSystemPrompts, getTitleGenerationPrompt } from "./system-prompts";
import AIToolManager from "@/tool-ai/ToolManager";
import { MessageV2 } from "@/types";
import AIModelManager from "./ModelManager";
import SkillLogic from "@/logic/skill-logic";
import RuleLogic from "@/logic/rule-logic";
import { CHAT_TITLE_MAX_LENGTH } from "./title-constants";
import { mergeTools } from "./agent-utils";
import { runStreamingTurn } from "./AgentRuntime";

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

    private buildSystemPrompt(): string {
        const basePrompt = getSystemPrompts()[0];
        const skillLogic = SkillLogic.getInstance();
        const activeSkills = skillLogic.getActiveSkillsForSession();
        
        let prompt = basePrompt;
        
        if (activeSkills.length > 0) {
            const skillsContent = activeSkills.map(skill => {
                return `## Skill: ${skill.name}\n${skill.description}\n\n${skill.body}`;
            }).join('\n\n---\n\n');
            prompt += `\n\n# Active Skills\n\nThe following skills are active for this conversation:\n\n${skillsContent}`;
        }
        
        const mainAgentRules = RuleLogic.getInstance().getRulesForMainAgent();
        if (mainAgentRules.length > 0) {
            const rulesContent = mainAgentRules.map(rule => {
                return `## Rule: ${rule.name}\n${rule.body}`;
            }).join('\n\n---\n\n');
            prompt += `\n\n# Rules\n\nThe following rules must be followed at all times:\n\n${rulesContent}`;
        }
        
        return prompt;
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
        const mergedTools = mergeTools(userTools, builtinTools, "[Agent]");
        const rawHistory = [...history, message.toModelMessage()];
        const { normalizedMessages, responseMessages } = await runStreamingTurn({
            agentConfig,
            instructions: this.buildSystemPrompt(),
            tools: mergedTools,
            addMessage,
            rawMessages: rawHistory,
            abortSignal: abortController.signal,
            normalizeMessages: (messages: ModelMessage[]) => modelManager.normalizeMessages(messages),
            maxRetries: 3,
        });
        return [...normalizedMessages, ...responseMessages];
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