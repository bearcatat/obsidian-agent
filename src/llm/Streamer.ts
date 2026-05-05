import { AssistantMessage } from "@/messages/assistant-message";
import { MessageV2 } from "@/types";
import { ModelMessage, ToolLoopAgent, ToolSet, TextStreamPart, StreamTextResult, GenerateTextResult } from "ai";
import { v4 as uuidv4 } from 'uuid';


export default class Streamer {
    private agent: ToolLoopAgent;
    private assistantMessage: AssistantMessage = AssistantMessage.createEmpty("");
    private addMessage: (message: MessageV2) => void;

    constructor(agent: ToolLoopAgent, addMessage: (message: MessageV2) => void) {
        this.agent = agent
        this.addMessage = addMessage
    }

    async stream(
        messages: Array<ModelMessage>,
        abortSignal: AbortSignal,
    ): Promise<StreamTextResult<{}, never>> {
        const result = await this.agent.stream({
            messages: messages,
            abortSignal: abortSignal,
        })
        for await (const chunk of result.fullStream) {
            await this.handleChunk(chunk)
        }
        return result
    }

    async handleChunk(chunk: TextStreamPart<{}>) {
        switch (chunk.type) {
            case "start-step":
                this.assistantMessage = AssistantMessage.createEmpty(uuidv4());
                break;
            case "text-delta":
                this.assistantMessage.appendContent(chunk.text);
                this.addMessage(this.assistantMessage)
                break;
            case "reasoning-delta":
                this.assistantMessage.appendReasoningContent(chunk.text);
                this.addMessage(this.assistantMessage)
                break;
            case "finish": {
                const finishChunk = chunk as any;
                if (finishChunk.usage) {
                    const usage = finishChunk.usage;
                    this.assistantMessage.usage = {
                        inputTokens: usage?.inputTokens,
                        outputTokens: usage?.outputTokens,
                        totalTokens: usage?.totalTokens ?? ((usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)),
                        cacheReadTokens: usage?.inputTokenDetails?.cacheReadTokens,
                        cacheWriteTokens: usage?.inputTokenDetails?.cacheWriteTokens,
                        reasoningTokens: usage?.outputTokenDetails?.reasoningTokens,
                    };
                }
                this.assistantMessage.close();
                this.addMessage(this.assistantMessage);
                break;
            }
            case "finish-step": {
                const finishStepChunk = chunk as any;
                if (finishStepChunk.usage) {
                    const usage = finishStepChunk.usage;
                    this.assistantMessage.usage = {
                        inputTokens: usage.inputTokens,
                        outputTokens: usage.outputTokens,
                        totalTokens: usage.totalTokens ?? ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)),
                        cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens,
                        cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens,
                        reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
                    };
                }
                this.assistantMessage.close();
                this.addMessage(this.assistantMessage);
                break;
            }
            case "tool-input-start":
                this.assistantMessage.close();
                this.addMessage(this.assistantMessage);
                break;
        }
    }

    async generate(
        messages: Array<ModelMessage>,
        abortSignal: AbortSignal,
    ): Promise<GenerateTextResult<{}, never>> {
        const result = await this.agent.generate({
            messages: messages,
            abortSignal: abortSignal,
            onStepFinish: async ({ text, reasoningText, usage }) => {
                this.assistantMessage = AssistantMessage.createEmpty(uuidv4())
                this.assistantMessage.appendContent(text)
                this.assistantMessage.appendReasoningContent(reasoningText ?? "")
                
                if (usage) {
                    const u = usage as any;
                    this.assistantMessage.usage = {
                        inputTokens: u.promptTokens ?? u.inputTokens,
                        outputTokens: u.completionTokens ?? u.outputTokens,
                        totalTokens: u.totalTokens,
                        cacheReadTokens: u.promptTokensDetails?.cachedTokens ?? u.inputTokenDetails?.cacheReadTokens,
                        cacheWriteTokens: u.inputTokenDetails?.cacheWriteTokens,
                        reasoningTokens: u.completionTokensDetails?.reasoningTokens ?? u.outputTokenDetails?.reasoningTokens,
                    };
                }

                this.assistantMessage.close()
                this.addMessage(this.assistantMessage)
            }
        })
        return result
    }
}