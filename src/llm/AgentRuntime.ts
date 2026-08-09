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
    const recordApprovalActions = (step: any) => {
        const actions = context.bashApprovalContext?.currentTurnActions;
        if (!actions || !Array.isArray(step?.toolCalls)) return;
        const results = new Map<string, any>((Array.isArray(step.toolResults) ? step.toolResults : [])
            .map((result: any) => [String(result?.toolCallId ?? ""), result]));
        for (const call of step.toolCalls) {
            const result = results.get(String(call?.toolCallId ?? ""));
            let argumentsSummary = "";
            try {
                argumentsSummary = JSON.stringify(call?.input ?? call?.args ?? {}).slice(0, 500);
            } catch {
                argumentsSummary = "[unserializable arguments]";
            }
            actions.push({
                toolName: String(call?.toolName ?? "unknown"),
                argumentsSummary,
                status: result?.error ? "failed" : result ? "completed" : "unknown",
            });
        }
        if (actions.length > 16) actions.splice(0, actions.length - 16);
    };
    const existingOnStepFinish = agentConfig.onStepFinish;
    const agentOptions: ToolLoopAgentSettings = {
        ...agentConfig,
        instructions,
        tools,
        toolChoice: "auto",
        experimental_context: context,
        stopWhen: [],
        onStepFinish: async (step: any) => {
            recordApprovalActions(step);
            await existingOnStepFinish?.(step);
        },
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
