import { MessageV2 } from "@/types";
import { ModelMessage, ToolLoopAgent, ToolLoopAgentSettings, ToolSet } from "ai";
import Streamer from "./Streamer";
import { AgentToolContext } from "@/tool/ToolContext";

type RunStreamingTurnParams = {
    agentConfig: ToolLoopAgentSettings;
    instructions: string;
    tools: ToolSet;
    addMessage: (message: MessageV2) => void;
    rawMessages: ModelMessage[];
    abortSignal: AbortSignal;
    normalizeMessages: (messages: ModelMessage[]) => ModelMessage[];
    maxRetries?: number;
    context: AgentToolContext;
}

export async function runStreamingTurn({
    agentConfig,
    instructions,
    tools,
    addMessage,
    rawMessages,
    abortSignal,
    normalizeMessages,
    maxRetries,
    context,
}: RunStreamingTurnParams): Promise<{
    normalizedMessages: ModelMessage[];
    responseMessages: ModelMessage[];
    text: string;
}> {
    const agentOptions: ToolLoopAgentSettings = {
        ...agentConfig,
        instructions,
        tools,
        toolChoice: "auto",
        experimental_context: context,
        stopWhen: [],
    };

    if (maxRetries !== undefined) {
        agentOptions.maxRetries = maxRetries;
    }

    const agent = new ToolLoopAgent(agentOptions);
    const normalizedMessages = normalizeMessages(rawMessages);
    const streamer = new Streamer(agent, addMessage);
    const result = await streamer.stream(normalizedMessages, abortSignal);
    const responseMessages = (await result.response).messages;

    return {
        normalizedMessages,
        responseMessages,
        text: await result.text,
    };
}
