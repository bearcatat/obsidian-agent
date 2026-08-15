import {
    ContextCheckpoint,
    ContextCompactionReason,
    ContextRuntimeState,
    ContextUsageCalibration,
    MessageV2,
    ModelConfig,
    ModelVariant,
} from "@/types";
import { ModelMessage, ToolLoopAgent, ToolLoopAgentSettings, ToolSet } from "ai";
import Streamer, { StreamingExecutionEvidence } from "./Streamer";
import { AgentToolContext } from "@/tool/ToolContext";
import {
    ActiveContextResult,
    applyUsageCalibration,
    assembleActiveContext,
    calculateContextBudget,
    classifyContextOverflow,
    CONTEXT_CHECKPOINT_SYSTEM_INSTRUCTIONS,
    ContextCalibrationKey,
    ContextCompactionError,
    createContextCheckpoint,
    estimateContextTokens,
    getCumulativeMessageDelta,
    getValidContextWindow,
    serializeContextForModel,
    serializeToolSchemas,
    updateUsageCalibration,
    withContextCompactionLock,
} from "./ContextCompaction";

export interface RuntimeCheckpointCommit {
    checkpoint: ContextCheckpoint;
    retainedTurnCount: number;
}

export interface ContextCompactionController {
    conversationId: string;
    modelConfig: ModelConfig;
    variant: ModelVariant | null;
    turnIds: string[];
    checkpoint?: ContextCheckpoint;
    calibration?: ContextUsageCalibration;
    autoContextCompaction: boolean;
    forceCompaction?: { reason: ContextCompactionReason; focus?: string };
    takePendingManualFocus?: () => string | undefined;
    onCheckpoint: (commit: RuntimeCheckpointCommit) => void | Promise<void>;
    onCalibration: (calibration: ContextUsageCalibration) => void | Promise<void>;
    onRuntimeState: (state: ContextRuntimeState) => void | Promise<void>;
    onRetryableError?: (error: ContextCompactionError) => void | Promise<void>;
    onDurableStepMessages?: (messages: ModelMessage[]) => void | Promise<void>;
}

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
    contextCompaction?: ContextCompactionController;
}

interface PreparedEstimate {
    heuristicTokens: number;
    key: ContextCalibrationKey;
}

function getLanguageModelIdentity(model: any, modelConfig: ModelConfig, variant: ModelVariant | null): ContextCalibrationKey {
    return {
        modelConfigId: modelConfig.id,
        provider: typeof model === 'string' ? modelConfig.provider : String(model?.provider ?? modelConfig.provider),
        modelId: typeof model === 'string' ? model : String(model?.modelId ?? modelConfig.name),
        variant,
    };
}

function systemToText(system: any): string {
    if (typeof system === 'string') return system;
    if (Array.isArray(system)) return system.map(systemToText).join('\n\n');
    if (system && typeof system.content === 'string') return system.content;
    try {
        return JSON.stringify(system ?? '');
    } catch {
        return '';
    }
}

function appendCheckpointSafety(system: any, checkpointApplied: boolean): any {
    if (!checkpointApplied) return system;
    if (typeof system === 'string') return `${system}${CONTEXT_CHECKPOINT_SYSTEM_INSTRUCTIONS}`;
    const safetyMessage = { role: 'system' as const, content: CONTEXT_CHECKPOINT_SYSTEM_INSTRUCTIONS.trim() };
    if (Array.isArray(system)) return [...system, safetyMessage];
    if (system) return [system, safetyMessage];
    return safetyMessage;
}

function compactionErrorState(error: ContextCompactionError, contextWindow?: number): ContextRuntimeState {
    return {
        status: 'error',
        lastError: error.message,
        retryable: error.retryable,
        contextWindow,
        lastReason: error.reason,
        message: '压缩失败',
    };
}

function hasExecutionEvidence(evidence: StreamingExecutionEvidence): boolean {
    return evidence.hasAssistantOutput || evidence.hasToolCall || evidence.hasToolResult;
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
    contextCompaction,
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
    const existingPrepareStep = agentConfig.prepareStep;
    const contextWindow = getValidContextWindow(contextCompaction?.modelConfig);
    const configuredMaxOutputTokens = contextCompaction?.modelConfig.maxTokens ?? agentConfig.maxOutputTokens;
    const budget = contextWindow
        ? calculateContextBudget(contextWindow, configuredMaxOutputTokens)
        : undefined;
    const invalidBudget = Boolean(contextWindow && !budget);
    const toolSchemas = await serializeToolSchemas(tools);
    let runtimeCheckpoint = contextCompaction?.checkpoint;
    let runtimeCalibration = contextCompaction?.calibration;
    let forcedCompaction = contextCompaction?.forceCompaction;
    let preparedEstimates: PreparedEstimate[] = [];

    const reportRuntime = async (state: ContextRuntimeState): Promise<void> => {
        await contextCompaction?.onRuntimeState(state);
    };

    const buildActiveContext = (
        messages: ModelMessage[],
        checkpoint = runtimeCheckpoint,
    ): ActiveContextResult => contextCompaction
        ? assembleActiveContext({ rawMessages: messages, turnIds: contextCompaction.turnIds, checkpoint })
        : {
            messages: serializeContextForModel(messages),
            retainedTurnCount: messages.filter(message => message.role === 'user').length,
            checkpointApplied: false,
        };

    const performCompaction = async ({
        messages,
        reason,
        focus,
        estimateBefore,
        key,
        system,
    }: {
        messages: ModelMessage[];
        reason: ContextCompactionReason;
        focus?: string;
        estimateBefore: number;
        key: ContextCalibrationKey;
        system: any;
    }): Promise<void> => {
        if (!contextCompaction) return;
        await withContextCompactionLock(contextCompaction.conversationId, async () => {
            await reportRuntime({
                status: 'compacting',
                contextWindow,
                estimatedInputTokens: estimateBefore,
                lastReason: reason,
                message: '正在压缩上下文',
            });
            try {
                const generated = await createContextCheckpoint({
                    agentConfig,
                    rawMessages: messages,
                    turnIds: contextCompaction.turnIds,
                    existingCheckpoint: runtimeCheckpoint,
                    reason,
                    focus,
                    contextWindow,
                    estimatedTokensBefore: estimateBefore,
                    abortSignal,
                });
                const active = assembleActiveContext({
                    rawMessages: messages,
                    turnIds: contextCompaction.turnIds,
                    checkpoint: generated.checkpoint,
                });
                const normalized = normalizeMessages(active.messages);
                const estimatedSystem = appendCheckpointSafety(system, active.checkpointApplied);
                const heuristicAfter = estimateContextTokens({
                    system: systemToText(estimatedSystem),
                    messages: normalized,
                    toolSchemas,
                }).heuristicInputTokens;
                const estimatedAfter = applyUsageCalibration(heuristicAfter, runtimeCalibration, key);
                const checkpoint: ContextCheckpoint = {
                    ...generated.checkpoint,
                    estimatedTokensAfter: estimatedAfter,
                };
                await contextCompaction.onCheckpoint({
                    checkpoint,
                    retainedTurnCount: generated.retainedTurnCount,
                });
                runtimeCheckpoint = checkpoint;
                await reportRuntime({
                    status: 'idle',
                    contextWindow,
                    heuristicInputTokens: heuristicAfter,
                    estimatedInputTokens: estimatedAfter,
                    retainedTurnCount: generated.retainedTurnCount,
                    lastCompactedAt: checkpoint.createdAt,
                    lastReason: reason,
                    message: `已压缩，保留最近 ${generated.retainedTurnCount} 轮`,
                });
            } catch (error) {
                if (abortSignal.aborted) {
                    await reportRuntime({ status: 'idle', contextWindow });
                    throw error;
                }
                const compactionError = error instanceof ContextCompactionError
                    ? error
                    : new ContextCompactionError(
                        'Context compaction failed before a checkpoint could be committed.',
                        'summary',
                        reason,
                        true,
                        error,
                    );
                if (compactionError.retryable) {
                    await contextCompaction.onRetryableError?.(compactionError);
                }
                await reportRuntime(compactionErrorState(compactionError, contextWindow));
                throw compactionError;
            }
        });
    };

    const createAgent = (): ToolLoopAgent => {
        let durableResponseMessageCount = 0;
        const agentOptions: ToolLoopAgentSettings = {
            ...agentConfig,
            instructions,
            tools,
            toolChoice: "auto",
            experimental_context: context,
            stopWhen: [],
            prepareStep: async (options: any) => {
                const preparedByProvider = await existingPrepareStep?.(options);
                const sourceMessages = options.messages as ModelMessage[];
                const preparedSystem = preparedByProvider?.system ?? instructions;
                const preparedModel = preparedByProvider?.model ?? options.model;
                const key = contextCompaction
                    ? getLanguageModelIdentity(preparedModel, contextCompaction.modelConfig, contextCompaction.variant)
                    : getLanguageModelIdentity(preparedModel, context.model, context.variant);

                await reportRuntime({ status: 'estimating', contextWindow, message: '正在估算上下文' });
                let active = buildActiveContext(sourceMessages);
                let normalized = normalizeMessages(active.messages);
                let system = appendCheckpointSafety(preparedSystem, active.checkpointApplied);
                let heuristicTokens = estimateContextTokens({
                    system: systemToText(system),
                    messages: normalized,
                    toolSchemas,
                }).heuristicInputTokens;
                let estimatedTokens = applyUsageCalibration(heuristicTokens, runtimeCalibration, key);

                const pendingManualFocus = contextCompaction?.takePendingManualFocus?.();
                const manualRequested = pendingManualFocus !== undefined;
                const force = options.stepNumber === 0 ? forcedCompaction : undefined;
                const overBudget = Boolean(
                    contextCompaction?.autoContextCompaction
                    && budget
                    && estimatedTokens > budget.maxEstimatedInputTokens,
                );
                const reason: ContextCompactionReason | undefined = manualRequested
                    ? 'manual'
                    : force?.reason
                        ? force.reason
                        : overBudget
                            ? (options.stepNumber === 0 ? 'preflight' : 'step-growth')
                            : undefined;

                if (reason) {
                    await performCompaction({
                        messages: sourceMessages,
                        reason,
                        focus: manualRequested ? pendingManualFocus : force?.focus,
                        estimateBefore: estimatedTokens,
                        key,
                        system: preparedSystem,
                    });
                    forcedCompaction = undefined;
                    active = buildActiveContext(sourceMessages);
                    normalized = normalizeMessages(active.messages);
                    system = appendCheckpointSafety(preparedSystem, active.checkpointApplied);
                    heuristicTokens = estimateContextTokens({
                        system: systemToText(system),
                        messages: normalized,
                        toolSchemas,
                    }).heuristicInputTokens;
                    estimatedTokens = applyUsageCalibration(heuristicTokens, runtimeCalibration, key);
                }

                preparedEstimates.push({ heuristicTokens, key });
                await reportRuntime(invalidBudget
                    ? {
                        status: 'error',
                        contextWindow,
                        heuristicInputTokens: heuristicTokens,
                        estimatedInputTokens: estimatedTokens,
                        lastError: 'Context window must be larger than Max output tokens.',
                        retryable: false,
                        message: 'Context window 配置无效',
                    }
                    : {
                        status: 'idle',
                        contextWindow,
                        heuristicInputTokens: heuristicTokens,
                        estimatedInputTokens: estimatedTokens,
                        retainedTurnCount: active.retainedTurnCount,
                        lastCompactedAt: runtimeCheckpoint?.createdAt,
                        lastReason: runtimeCheckpoint?.reason,
                        message: runtimeCheckpoint
                            ? `已压缩，保留最近 ${active.retainedTurnCount} 轮`
                            : undefined,
                    });

                return {
                    ...preparedByProvider,
                    system,
                    messages: normalized,
                };
            },
            onStepFinish: async (step: any) => {
                recordApprovalActions(step);
                const prepared = preparedEstimates.shift();
                if (prepared && contextCompaction) {
                    const nextCalibration = updateUsageCalibration({
                        current: runtimeCalibration,
                        key: prepared.key,
                        heuristicTokens: prepared.heuristicTokens,
                        inputTokens: step?.usage?.inputTokens,
                    });
                    if (nextCalibration && nextCalibration !== runtimeCalibration) {
                        runtimeCalibration = nextCalibration;
                        await contextCompaction.onCalibration(nextCalibration);
                    }
                }
                if (contextCompaction?.onDurableStepMessages && Array.isArray(step?.response?.messages)) {
                    const responseMessages = step.response.messages as ModelMessage[];
                    const delta = getCumulativeMessageDelta(responseMessages, durableResponseMessageCount);
                    if (delta.messages.length > 0) {
                        await contextCompaction.onDurableStepMessages(delta.messages);
                    }
                    durableResponseMessageCount = delta.nextCount;
                }
                await existingOnStepFinish?.(step);
            },
        };

        if (maxRetries !== undefined) agentOptions.maxRetries = maxRetries;
        return new ToolLoopAgent(agentOptions);
    };

    if (contextWindow && !budget) {
        await reportRuntime({
            status: 'error',
            contextWindow,
            lastError: 'Context window must be larger than Max output tokens.',
            retryable: false,
            message: 'Context window 配置无效',
        });
    }

    const normalizedMessages = normalizeMessages(rawMessages);
    let overflowRecoveryAttempted = false;

    while (true) {
        preparedEstimates = [];
        const agent = createAgent();
        const streamer = new Streamer(agent, addMessage);
        try {
            const result = await streamer.stream(rawMessages, abortSignal);
            const responseMessages = (await result.response).messages;
            return {
                normalizedMessages,
                responseMessages,
                text: await result.text,
            };
        } catch (error) {
            if (abortSignal.aborted) throw error;
            const overflow = classifyContextOverflow(error);
            const evidence = streamer.getExecutionEvidence();
            if (
                overflow
                && contextCompaction?.autoContextCompaction
                && !overflowRecoveryAttempted
                && !hasExecutionEvidence(evidence)
                && (!contextWindow || budget)
            ) {
                overflowRecoveryAttempted = true;
                const key = getLanguageModelIdentity(agentConfig.model, contextCompaction.modelConfig, contextCompaction.variant);
                const active = buildActiveContext(rawMessages);
                const normalized = normalizeMessages(active.messages);
                const system = appendCheckpointSafety(instructions, active.checkpointApplied);
                const heuristic = estimateContextTokens({
                    system: systemToText(system),
                    messages: normalized,
                    toolSchemas,
                }).heuristicInputTokens;
                await performCompaction({
                    messages: rawMessages,
                    reason: 'overflow',
                    estimateBefore: applyUsageCalibration(heuristic, runtimeCalibration, key),
                    key,
                    system: instructions,
                });
                continue;
            }

            if (overflow) {
                const message = hasExecutionEvidence(evidence)
                    ? 'The Provider reported context overflow after assistant or tool execution evidence. Automatic replay was blocked to avoid duplicate effects.'
                    : overflowRecoveryAttempted
                        ? 'The Provider still reported context overflow after one compaction recovery attempt.'
                        : contextCompaction?.autoContextCompaction
                            ? 'The Provider reported context overflow, but the current context configuration could not be recovered safely.'
                            : 'The Provider reported context overflow. Automatic recovery is disabled; use /compact or enable automatic context compaction.';
                const overflowError = new ContextCompactionError(
                    message,
                    'overflow',
                    'overflow',
                    !hasExecutionEvidence(evidence),
                    error,
                );
                if (overflowError.retryable) {
                    await contextCompaction?.onRetryableError?.(overflowError);
                }
                await reportRuntime(compactionErrorState(overflowError, contextWindow));
                throw overflowError;
            }
            throw error;
        }
    }
}
