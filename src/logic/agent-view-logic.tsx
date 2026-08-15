import {
  ContextCheckpoint,
  ContextCompactionReason,
  ContextRuntimeState,
  ContextUsageCalibration,
  MessageV2,
  ModelConfig,
  ModelVariant,
  getDefaultVariant,
} from "../types";
import { agentStore } from "../state/agent-state-impl";
import { settingsStore } from "../state/settings-state-impl";
import { App, Notice } from "obsidian";
import { UserMessage } from "@/messages/user-message";
import AIAgent from "@/llm/Agent";
import AIModelManager from "@/llm/ModelManager";
import { CHAT_TITLE_MAX_LENGTH } from "@/llm/title-constants";
import { SessionLogic } from "./session-logic";
import { FileReviewLogic } from "./file-review-logic";
import SkillLogic from "./skill-logic";
import MemoryLogic from "./memory-logic";
import { ModelMessage } from "ai";
import { ContextCompactionController } from "@/llm/AgentRuntime";
import { ContextCompactionError, validateContextCheckpoint } from "@/llm/ContextCompaction";
import { ConversationState } from "@/state/agent-state";
import { getErrorMessage, t } from "@/i18n";

interface PendingTurnRetry {
  userMessage: UserMessage;
  forceCompaction?: { reason: ContextCompactionReason; focus?: string };
}

interface ManualCompactionSnapshot {
  rawMessages: ModelMessage[];
  turnIds: string[];
  checkpoint?: ContextCheckpoint;
  calibration?: ContextUsageCalibration;
  activeSkills: string[];
  focus?: string;
}

function getPendingTurnForceCompaction(error: ContextCompactionError): PendingTurnRetry['forceCompaction'] {
  return error.reason === 'overflow'
    && (error.stage === 'summary' || error.stage === 'validation')
    ? { reason: 'overflow' }
    : undefined;
}

export class AgentViewLogic {
  private static instance: AgentViewLogic;
  private pendingTurnRetries = new Map<string, PendingTurnRetry>();
  private manualRetrySnapshots = new Map<string, ManualCompactionSnapshot>();

  private constructor() {}

  static getInstance(): AgentViewLogic {
    if (!AgentViewLogic.instance) AgentViewLogic.instance = new AgentViewLogic();
    return AgentViewLogic.instance;
  }

  static resetInstance(): void {
    AgentViewLogic.instance = undefined as any;
  }

  private getTurnIds(conversation: ConversationState): string[] {
    return conversation.messages.filter(message => message.role === 'user').map(message => message.id);
  }

  private getApprovalHistory(conversation: ConversationState, turnId: string): ModelMessage[] {
    const turnIds = this.getTurnIds(conversation);
    const targetUserIndex = turnIds.indexOf(turnId);
    if (targetUserIndex < 0) return conversation.modelMessages;

    let userIndex = 0;
    for (let index = 0; index < conversation.modelMessages.length; index++) {
      if (conversation.modelMessages[index].role !== 'user') continue;
      if (userIndex === targetUserIndex) return conversation.modelMessages.slice(0, index);
      userIndex += 1;
    }
    return conversation.modelMessages;
  }

  private takePendingManualFocus(conversationId: string): string | undefined {
    const store = agentStore.getState();
    const conversation = store.conversations[conversationId];
    const focus = conversation?.contextRuntimeState.pendingFocus;
    if (focus === undefined || !conversation) return undefined;
    const { pendingFocus: _pendingFocus, ...runtimeState } = conversation.contextRuntimeState;
    store.setContextRuntimeState({
      ...runtimeState,
      message: runtimeState.status === 'error' ? runtimeState.message : undefined,
    }, conversationId);
    return focus;
  }

  private queueManualCompaction(conversationId: string, focus?: string): void {
    const store = agentStore.getState();
    const conversation = store.conversations[conversationId];
    if (!conversation) return;
    const trimmedFocus = focus?.trim();
    const existingFocus = conversation.contextRuntimeState.pendingFocus;
    store.setContextRuntimeState({
      ...conversation.contextRuntimeState,
      pendingFocus: trimmedFocus || existingFocus || '',
      message: t('agent:compactionQueued'),
    }, conversationId);
  }

  private createContextController(
    conversationId: string,
    model: ModelConfig,
    variant: ModelVariant | null,
    forceCompaction?: { reason: ContextCompactionReason; focus?: string },
    retryUserMessage?: UserMessage,
  ): ContextCompactionController {
    const conversation = agentStore.getState().conversations[conversationId];
    const turnIds = conversation ? this.getTurnIds(conversation) : [];
    const currentTurnId = turnIds.at(-1);
    return {
      conversationId,
      modelConfig: model,
      variant,
      turnIds,
      checkpoint: conversation?.contextCheckpoint,
      calibration: conversation?.contextUsageCalibration,
      autoContextCompaction: settingsStore.getState().autoContextCompaction,
      forceCompaction,
      takePendingManualFocus: () => this.takePendingManualFocus(conversationId),
      onCheckpoint: async ({ checkpoint }) => {
        const latestStore = agentStore.getState();
        const latest = latestStore.conversations[conversationId];
        if (!latest || !validateContextCheckpoint(checkpoint, this.getTurnIds(latest))) {
          throw new ContextCompactionError(
            'The conversation changed before the generated checkpoint could be committed.',
            'validation',
            checkpoint.reason,
            false,
          );
        }
        latestStore.setContextCheckpoint(checkpoint, conversationId);
        latestStore.setUpdatedAt(Date.now(), conversationId);
        const committed = agentStore.getState().conversations[conversationId];
        if (committed) await SessionLogic.getInstance().saveSessionNow(committed);
      },
      onCalibration: calibration => {
        const latestStore = agentStore.getState();
        latestStore.setContextUsageCalibration(calibration, conversationId);
        const latest = agentStore.getState().conversations[conversationId];
        if (latest) SessionLogic.getInstance().saveSession(latest);
      },
      onRuntimeState: runtimeState => {
        const latestStore = agentStore.getState();
        const latest = latestStore.conversations[conversationId];
        if (!latest) return;
        const pendingFocus = latest.contextRuntimeState.pendingFocus;
        latestStore.setContextRuntimeState({
          ...runtimeState,
          ...(pendingFocus !== undefined ? { pendingFocus } : {}),
        }, conversationId);
      },
      onRetryableError: error => {
        if (!retryUserMessage) return;
        this.pendingTurnRetries.set(conversationId, {
          userMessage: retryUserMessage,
          forceCompaction: getPendingTurnForceCompaction(error),
        });
      },
      onDurableStepMessages: responseMessages => {
        if (responseMessages.length === 0) return;
        const latestStore = agentStore.getState();
        const latest = latestStore.conversations[conversationId];
        if (!latest) return;
        if (currentTurnId && !this.getTurnIds(latest).includes(currentTurnId)) return;
        latestStore.setModelMessages([...latest.modelMessages, ...responseMessages], conversationId);
        latestStore.setUpdatedAt(Date.now(), conversationId);
        const updated = agentStore.getState().conversations[conversationId];
        if (updated) SessionLogic.getInstance().saveSession(updated);
      },
    };
  }

  async sendMessage(userMessage: UserMessage, requestedConversationId?: string): Promise<void> {
    let store = agentStore.getState();
    let conversationId = requestedConversationId ?? store.activeConversationId;
    if (!conversationId) {
      conversationId = await SessionLogic.getInstance().createSession();
      store.createConversation(conversationId);
      store = agentStore.getState();
    }
    if (requestedConversationId && !store.conversations[requestedConversationId]) return;
    const targetId = conversationId;
    const conversation = store.conversations[targetId];
    if (!conversation || conversation.isLoading || !(conversation.model ?? store.model)) return;

    this.pendingTurnRetries.delete(targetId);
    this.manualRetrySnapshots.delete(targetId);
    const titlePromise = this.setTitleIfNewChat(userMessage.content, targetId);
    store.addMessage(userMessage, targetId);
    const withUser = agentStore.getState().conversations[targetId];
    if (!withUser) return;
    store.setModelMessages([...withUser.modelMessages, userMessage.toModelMessage()], targetId);
    await this.runPersistedTurn(userMessage, targetId, titlePromise);
  }

  private async runPersistedTurn(
    userMessage: UserMessage,
    conversationId: string,
    titlePromise?: Promise<void>,
    forceCompaction?: { reason: ContextCompactionReason; focus?: string },
  ): Promise<void> {
    const initialStore = agentStore.getState();
    const initialConversation = initialStore.conversations[conversationId];
    const model = initialConversation?.model ?? initialStore.model;
    const variant = initialConversation?.variant ?? initialStore.variant;
    if (!initialConversation || initialConversation.isLoading || !model) return;

    this.pendingTurnRetries.delete(conversationId);
    initialStore.setLoading(true, conversationId);
    const abortController = new AbortController();
    initialStore.setAbortController(abortController, conversationId);
    let completedSuccessfully = false;

    try {
      const current = agentStore.getState().conversations[conversationId];
      if (!current) return;
      const memoryContext = await MemoryLogic.getInstance().loadCompactMemoryIndex();
      await AIAgent.getInstance().query(
        userMessage,
        current.modelMessages,
        abortController,
        message => agentStore.getState().addMessage(message, conversationId),
        {
          conversationId,
          model,
          variant,
          activeSkills: current.activeSkills,
          activateSkill: name => this.activateSkill(name, conversationId),
          memoryContext,
          approvalHistory: this.getApprovalHistory(current, userMessage.id),
          contextCompaction: this.createContextController(conversationId, model, variant, forceCompaction, userMessage),
        },
      );
      await titlePromise;
      this.pendingTurnRetries.delete(conversationId);
      completedSuccessfully = true;
    } catch (error) {
      if (!abortController.signal.aborted) {
        if (error instanceof ContextCompactionError) {
          if (error.retryable) {
            this.pendingTurnRetries.set(conversationId, {
              userMessage,
              forceCompaction: getPendingTurnForceCompaction(error),
            });
          }
          const errorStore = agentStore.getState();
          errorStore.setUnread(errorStore.activeConversationId !== conversationId, conversationId);
          new Notice(t('agent:contextCompactionFailed', { cause: error.message }), 5000);
        } else {
          const runtimeState = agentStore.getState().conversations[conversationId]?.contextRuntimeState;
          if (runtimeState?.status === 'error' && runtimeState.retryable) {
            new Notice(t('agent:contextCompactionFailed', {
              cause: runtimeState.lastError ?? t('agent:compactionFailedShort'),
            }), 5000);
          } else {
            console.error('Failed to send message:', error);
            new Notice(t('agent:sendMessageFailed', { cause: getErrorMessage(error) }), 3000);
          }
        }
      }
    } finally {
      const latest = agentStore.getState();
      latest.setLoading(false, conversationId);
      latest.setAbortController(null, conversationId);
      if (abortController.signal.aborted) {
        const aborted = latest.conversations[conversationId];
        if (aborted) {
          const { pendingFocus: _pendingFocus, ...runtimeState } = aborted.contextRuntimeState;
          latest.setContextRuntimeState({ ...runtimeState, status: 'idle', message: undefined }, conversationId);
        }
      }
      latest.setUpdatedAt(Date.now(), conversationId);
      if (completedSuccessfully) {
        latest.setUnread(latest.activeConversationId !== conversationId, conversationId);
      }
      const completed = agentStore.getState().conversations[conversationId];
      if (completed) await SessionLogic.getInstance().saveSessionNow(completed);
    }

    if (!abortController.signal.aborted) {
      const queuedFocus = this.takePendingManualFocus(conversationId);
      if (queuedFocus !== undefined) await this.runManualCompaction(conversationId, queuedFocus);
    }
  }

  async requestContextCompaction(focus?: string, requestedConversationId?: string): Promise<void> {
    const store = agentStore.getState();
    const conversationId = requestedConversationId ?? store.activeConversationId;
    const conversation = conversationId ? store.conversations[conversationId] : undefined;
    if (!conversationId || !conversation || !(conversation.model ?? store.model)) {
      new Notice(t('agent:selectModelBeforeCompacting'));
      return;
    }
    if (conversation.isLoading) {
      this.queueManualCompaction(conversationId, focus);
      new Notice(t('agent:compactionQueued'));
      return;
    }
    await this.runManualCompaction(conversationId, focus);
  }

  private async runManualCompaction(
    conversationId: string,
    focus?: string,
    retrySnapshot?: ManualCompactionSnapshot,
  ): Promise<void> {
    const store = agentStore.getState();
    const conversation = store.conversations[conversationId];
    const model = conversation?.model ?? store.model;
    const variant = conversation?.variant ?? store.variant;
    if (!conversation || conversation.isLoading || !model) return;

    const snapshot: ManualCompactionSnapshot = retrySnapshot ?? {
      rawMessages: [...conversation.modelMessages],
      turnIds: this.getTurnIds(conversation),
      checkpoint: conversation.contextCheckpoint,
      calibration: conversation.contextUsageCalibration,
      activeSkills: [...conversation.activeSkills],
      focus: focus?.trim() || undefined,
    };
    const abortController = new AbortController();
    store.setLoading(true, conversationId);
    store.setAbortController(abortController, conversationId);
    store.setContextRuntimeState({
      ...conversation.contextRuntimeState,
      status: 'compacting',
      lastError: undefined,
      retryable: undefined,
      lastReason: 'manual',
      message: t('agent:compacting'),
      pendingFocus: undefined,
    }, conversationId);
    let compactedSuccessfully = false;

    try {
      const memoryContext = await MemoryLogic.getInstance().loadCompactMemoryIndex();
      const result = await AIAgent.getInstance().compactHistory({
        conversationId,
        rawMessages: snapshot.rawMessages,
        turnIds: snapshot.turnIds,
        checkpoint: snapshot.checkpoint,
        calibration: snapshot.calibration,
        model,
        variant,
        activeSkills: snapshot.activeSkills,
        memoryContext,
        focus: snapshot.focus,
        reason: 'manual',
        abortSignal: abortController.signal,
      });
      const latestStore = agentStore.getState();
      const latest = latestStore.conversations[conversationId];
      if (!latest || !validateContextCheckpoint(result.checkpoint, this.getTurnIds(latest))) {
        throw new ContextCompactionError(
          'The conversation was undone or changed before the checkpoint could be committed.',
          'validation',
          'manual',
          false,
        );
      }
      latestStore.setContextCheckpoint(result.checkpoint, conversationId);
      const pendingFocus = latest.contextRuntimeState.pendingFocus;
      latestStore.setContextRuntimeState({
        ...result.runtimeState,
        ...(pendingFocus !== undefined ? { pendingFocus } : {}),
      }, conversationId);
      latestStore.setUpdatedAt(Date.now(), conversationId);
      latestStore.setUnread(latestStore.activeConversationId !== conversationId, conversationId);
      this.manualRetrySnapshots.delete(conversationId);
      compactedSuccessfully = true;
      const committed = agentStore.getState().conversations[conversationId];
      if (committed) await SessionLogic.getInstance().saveSessionNow(committed);
    } catch (error) {
      if (abortController.signal.aborted) {
        agentStore.getState().setContextRuntimeState({ status: 'idle', contextWindow: model.contextWindow }, conversationId);
      } else {
        const compactionError = error instanceof ContextCompactionError
          ? error
          : new ContextCompactionError(
            'Context compaction failed before a checkpoint could be committed.',
            'summary',
            'manual',
            true,
            error,
          );
        const latestStore = agentStore.getState();
        const pendingFocus = latestStore.conversations[conversationId]?.contextRuntimeState.pendingFocus;
        latestStore.setContextRuntimeState({
          status: 'error',
          lastError: compactionError.message,
          retryable: compactionError.retryable,
          contextWindow: model.contextWindow,
          lastReason: 'manual',
          message: t('agent:compactionFailedShort'),
          ...(pendingFocus !== undefined ? { pendingFocus } : {}),
        }, conversationId);
        if (compactionError.retryable) this.manualRetrySnapshots.set(conversationId, snapshot);
        latestStore.setUnread(latestStore.activeConversationId !== conversationId, conversationId);
        new Notice(t('agent:contextCompactionFailed', { cause: compactionError.message }), 5000);
      }
    } finally {
      const latestStore = agentStore.getState();
      latestStore.setLoading(false, conversationId);
      latestStore.setAbortController(null, conversationId);
    }

    if (!abortController.signal.aborted) {
      const queuedFocus = this.takePendingManualFocus(conversationId);
      if (queuedFocus !== undefined) {
        await this.runManualCompaction(conversationId, queuedFocus);
      } else if (compactedSuccessfully) {
        const pendingTurn = this.pendingTurnRetries.get(conversationId);
        if (pendingTurn) {
          await this.runPersistedTurn(pendingTurn.userMessage, conversationId, undefined, pendingTurn.forceCompaction);
        }
      }
    }
  }

  async retryContextCompaction(requestedConversationId?: string): Promise<void> {
    const store = agentStore.getState();
    const conversationId = requestedConversationId ?? store.activeConversationId;
    if (!conversationId) return;
    const pendingTurn = this.pendingTurnRetries.get(conversationId);
    if (pendingTurn) {
      await this.runPersistedTurn(pendingTurn.userMessage, conversationId, undefined, pendingTurn.forceCompaction);
      return;
    }
    const manualSnapshot = this.manualRetrySnapshots.get(conversationId);
    if (manualSnapshot) await this.runManualCompaction(conversationId, manualSnapshot.focus, manualSnapshot);
  }

  addMessage(message: MessageV2, conversationId?: string): void {
    agentStore.getState().addMessage(message, conversationId);
  }

  async setTitleIfNewChat(userMessage: string, conversationId?: string): Promise<void> {
    const store = agentStore.getState();
    const id = conversationId ?? store.activeConversationId;
    const conversation = id ? store.conversations[id] : null;
    if (!id || conversation?.title !== 'New Chat') return;

    const fallbackTitle = userMessage.substring(0, CHAT_TITLE_MAX_LENGTH).trim() || 'New Chat';
    try {
      const title = await AIAgent.getInstance().generateTitle(userMessage);
      agentStore.getState().setTitle(title.trim() || fallbackTitle, id);
    } catch (error) {
      console.error('Failed to generate title:', error);
      agentStore.getState().setTitle(fallbackTitle, id);
    }
  }

  stopLoading(): void {
    const id = agentStore.getState().activeConversationId;
    if (id) this.stopConversation(id);
  }

  stopConversation(conversationId: string): void {
    const store = agentStore.getState();
    store.conversations[conversationId]?.abortController?.abort();
    this.pendingTurnRetries.delete(conversationId);
    this.manualRetrySnapshots.delete(conversationId);
    const conversation = store.conversations[conversationId];
    if (conversation) {
      const { pendingFocus: _pendingFocus, ...runtimeState } = conversation.contextRuntimeState;
      store.setContextRuntimeState({ ...runtimeState, status: 'idle', message: undefined }, conversationId);
    }
    store.setLoading(false, conversationId);
  }

  setTitle(title: string): void {
    agentStore.getState().setTitle(title);
  }

  async finalizePendingReviews(): Promise<void> {
    const store = agentStore.getState();
    for (const conversation of Object.values(store.conversations)) {
      if (conversation.isLoading) continue;
      FileReviewLogic.getInstance().flushPendingAsApplied(conversation.sessionId);
      const latest = agentStore.getState().conversations[conversation.sessionId];
      if (latest) await SessionLogic.getInstance().saveSessionNow(latest);
    }
  }

  async resetForNewChat(_app: App | undefined): Promise<void> {
    const store = agentStore.getState();
    const active = store.activeConversationId ? store.conversations[store.activeConversationId] : null;
    if (active && active.messages.length === 0 && !active.isLoading) return;
    const id = await SessionLogic.getInstance().createSession();
    agentStore.getState().createConversation(id);
  }

  setModel(model: ModelConfig, variant?: ModelVariant | null): void {
    const nextVariant = variant === undefined ? getDefaultVariant(model) : variant;
    agentStore.getState().setModel(model);
    agentStore.getState().setVariant(nextVariant);
    AIModelManager.getInstance().setAgent(model, nextVariant);
  }

  setTitleModel(model: ModelConfig, variant?: ModelVariant | null): void {
    const nextVariant = variant === undefined ? getDefaultVariant(model) : variant;
    AIModelManager.getInstance().setTitle(model, nextVariant);
  }

  activateSkill(name: string, conversationId?: string): boolean {
    if (!SkillLogic.getInstance().getSkillByName(name)) return false;
    const store = agentStore.getState();
    const id = conversationId ?? store.activeConversationId;
    const conversation = id ? store.conversations[id] : null;
    if (!id || !conversation) return false;
    store.setActiveSkills(Array.from(new Set([...conversation.activeSkills, name])), id);
    return true;
  }
}

export default AgentViewLogic;
