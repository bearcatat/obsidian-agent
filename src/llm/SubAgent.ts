import { MessageV2, ModelConfig, ModelVariant } from "@/types";
import { ModelMessage, ToolLoopAgentSettings, ToolSet } from "ai";
import AIModelManager from "./ModelManager";
import { UserMessage } from "@/messages/user-message";
import { runStreamingTurn } from "./AgentRuntime";
import { mergeTools } from "./agent-utils";

export default class SubAgent {
    private toolset: ToolSet = {};
    private messages: Array<ModelMessage> = new Array<ModelMessage>();
    private agentConfig: ToolLoopAgentSettings;
    private modelConfig: ModelConfig;
    private variant: ModelVariant | null;

    public name: string;
    public systemPrompt: string;
    public description: string;

    constructor(name: string, systemPrompt: string, description: string, modelConfig: ModelConfig, variant?: ModelVariant | null) {
        this.systemPrompt = systemPrompt;
        this.description = description;
        this.name = name;
        this.modelConfig = modelConfig;
        this.variant = variant ?? null;
        this.agentConfig = AIModelManager.getInstance().buildAgentConfig(modelConfig, this.variant ?? undefined)
    }

    async query(message: UserMessage,
        abortSignal: AbortSignal,
        addMessage: (message: MessageV2) => void
    ) {
        const builtinTools = this.agentConfig.tools;
        const mergedTools = mergeTools(this.toolset, builtinTools, `[SubAgent: ${this.name}]`);

        const rawMessages = [...this.messages, message.toModelMessage()]
        const { normalizedMessages, responseMessages, text } = await runStreamingTurn({
            agentConfig: this.agentConfig,
            instructions: this.systemPrompt,
            tools: mergedTools,
            addMessage,
            rawMessages,
            abortSignal,
            normalizeMessages: messages => AIModelManager.getInstance().normalizeMessages(messages, this.modelConfig, this.variant),
        })
        this.messages = [...normalizedMessages, ...responseMessages]
        return text
    }

    async clearMemory(): Promise<void> {
        this.messages = new Array<ModelMessage>()
    }

    setTools(toolset: ToolSet): void {
        this.toolset = toolset;
    }
}