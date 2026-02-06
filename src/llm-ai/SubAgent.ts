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

    async query(message: UserMessage,
        abortSignal: AbortSignal,
        addMessage: (message: MessageV2) => void
    ) {

        const agent = new ToolLoopAgent({
            ...AIModelManager.getInstance().agentConfig,
            instructions: this.systemPrompt,
            tools: this.toolset,
            toolChoice: 'auto',
            experimental_context: {
                addMessage: addMessage
            },
        })

        this.messages.push(message.toModelMessage())
        const streamer = new Streamer(agent, addMessage)
        const result = await streamer.stream(this.messages, abortSignal)
        const messages = (await result.response).messages
        this.messages.push(...messages)
        console.log("sub agent", this.messages)
        return result.text
    }

    async clearMemory(): Promise<void> {
        this.messages = new Array<ModelMessage>()
    }

    setTools(toolset: ToolSet): void {
        this.toolset = toolset;
    }
}