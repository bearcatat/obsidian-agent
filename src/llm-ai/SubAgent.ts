import { MessageV2, ModelConfig } from "@/types";
import { ModelMessage, ToolLoopAgent, ToolLoopAgentSettings, ToolSet } from "ai";
import AIModelManager from "./ModelManager";
import { UserMessage } from "@/messages/user-message";
import Streamer from "./Streamer";

export default class SubAgent {
    private toolset: ToolSet = {};
    private messages: Array<ModelMessage> = new Array<ModelMessage>();
    private agentConfig: ToolLoopAgentSettings;

    public name: string;
    public systemPrompt: string;
    public description: string;

    constructor(name: string, systemPrompt: string, description: string, modelConfig: ModelConfig) {
        this.systemPrompt = systemPrompt;
        this.description = description;
        this.name = name;
        this.agentConfig = AIModelManager.getInstance().getAgent(modelConfig)
    }

    private mergeTools(userTools: ToolSet, builtinTools: ToolSet | undefined): ToolSet {
        if (!builtinTools) {
            return userTools;
        }

        const mergedTools = { ...userTools };

        for (const [toolName, tool] of Object.entries(builtinTools)) {
            if (mergedTools[toolName]) {
                console.warn(`[SubAgent: ${this.name}] 内置工具 "${toolName}" 已覆盖用户自定义工具`);
            }
            mergedTools[toolName] = tool;
        }

        return mergedTools;
    }

    async query(message: UserMessage,
        abortSignal: AbortSignal,
        addMessage: (message: MessageV2) => void
    ) {
        const builtinTools = this.agentConfig.tools;
        const mergedTools = this.mergeTools(this.toolset, builtinTools);

        const agent = new ToolLoopAgent({
            ...this.agentConfig,
            instructions: this.systemPrompt,
            tools: mergedTools,
            toolChoice: 'auto',
            experimental_context: {
                addMessage: addMessage
            },
        })

        this.messages.push(message.toModelMessage())
        const streamer = new Streamer(agent, addMessage)
        const result = await streamer.generate(this.messages, abortSignal)
        const messages = (await result.response).messages
        this.messages.push(...messages)
        return result.text
    }

    async clearMemory(): Promise<void> {
        this.messages = new Array<ModelMessage>()
    }

    setTools(toolset: ToolSet): void {
        this.toolset = toolset;
    }
}