import { useAgentLogic } from "@/hooks/use-agent";
import { AssistantMessage } from "@/messages/assistant-message";
import { AssistantModelMessage, ToolModelMessage, ModelMessage, ToolLoopAgent, ToolSet, TextStreamPart } from "ai";
import { v4 as uuidv4 } from 'uuid';


export default class Streamer {
    private agent: ToolLoopAgent;
    private assistantMessage: AssistantMessage = AssistantMessage.createEmpty("");

    constructor(agent: ToolLoopAgent) {
        this.agent = agent
    }

    async stream(
        messages: Array<ModelMessage>,
        abortController: AbortController,
    ): Promise<Array<AssistantModelMessage | ToolModelMessage>> {
        const result = await this.agent.stream({
            messages: messages,
            abortSignal: abortController.signal,
        })
        for await (const chunk of result.fullStream) {
            await this.handleChunk(chunk)
        }
        return (await result.response).messages
    }

    async handleChunk(chunk: TextStreamPart<{}>) {
        console.log(chunk)
        const { addMessage } = useAgentLogic();
        switch (chunk.type) {
            case "start-step":
                this.assistantMessage = AssistantMessage.createEmpty(uuidv4());
                break;
            case "text-delta":
                this.assistantMessage.appendContent(chunk.text);
                addMessage(this.assistantMessage)
                break;
            case "reasoning-delta":
                this.assistantMessage.appendReasoningContent(chunk.text);
                addMessage(this.assistantMessage)
                break;
            case "finish":
            case "tool-input-start":
                this.assistantMessage.close();
                addMessage(this.assistantMessage);
                break;
        }
        console.log(this.assistantMessage)
    }
}