import { Bot } from "gramio";
import { TelegramFeedbackConfig, TelegramFeedbackProgress, TelegramFeedbackReply, TelegramFeedbackRequest, TelegramFeedbackResult, createDefaultTelegramFeedbackConfig } from "@/types";
import TelegramApiClient, { TelegramApiUpdate } from "./TelegramApiClient";
import { settingsStore } from "@/state/settings-state-impl";
import { persistSettingsStore } from "@/logic/settings-persistence";
import { IMAGE_ANALYSIS_SYSTEM_PROMPT } from "./prompts";
import AIModelManager from "@/llm-ai/ModelManager";
import { agentStore } from "@/state/agent-state-impl";
import SubAgent from "@/llm-ai/SubAgent";
import { UserMessage } from "@/messages/user-message";

interface BeginFeedbackRequestParams {
  question: string;
  allowImages: boolean;
  timeoutMs: number;
  submitButtonText: string;
  sessionId?: string | null;
  toolCallId?: string;
  onUpdate?: (update: TelegramFeedbackProgress) => void | Promise<void>;
}

interface PendingFeedbackRequest {
  request: TelegramFeedbackRequest;
  sourceMessageId?: number;
  replies: TelegramFeedbackReply[];
  timer: ReturnType<typeof setTimeout>;
  resolve: (result: TelegramFeedbackResult) => void;
  reject: (error: Error) => void;
  notifyUpdate?: (update: TelegramFeedbackProgress) => void | Promise<void>;
}

interface FeedbackAwaiter {
  requestId: string;
  promise: Promise<TelegramFeedbackResult>;
  cancel: (reason?: Error) => Promise<void>;
}

export default class TelegramFeedbackRuntime {
  private static instance: TelegramFeedbackRuntime;

  private bot: Bot | null = null;
  private client: TelegramApiClient | null = null;
  private config: TelegramFeedbackConfig = createDefaultTelegramFeedbackConfig();
  private pollGeneration = 0;
  private pollingAbortController: AbortController | null = null;
  private pollingOffset = 0;
  private pendingRequest: PendingFeedbackRequest | null = null;

  static getInstance(): TelegramFeedbackRuntime {
    if (!TelegramFeedbackRuntime.instance) {
      TelegramFeedbackRuntime.instance = new TelegramFeedbackRuntime();
    }
    return TelegramFeedbackRuntime.instance;
  }

  getConfig(): TelegramFeedbackConfig {
    return this.config;
  }

  async configure(config: TelegramFeedbackConfig): Promise<void> {
    const previousSignature = this.getRuntimeSignature(this.config);
    const nextSignature = this.getRuntimeSignature(config);
    this.config = { ...config };

    if (this.client) {
      this.client.updateConfig(this.config.botToken, this.config.proxyUrl);
    }

    if (!this.shouldRun()) {
      await this.stop();
      return;
    }

    if (!this.bot || previousSignature !== nextSignature) {
      await this.restart();
    }
  }

  async start(): Promise<void> {
    if (!this.shouldRun()) {
      return;
    }

    if (this.bot) {
      return;
    }

    this.client = new TelegramApiClient(this.config.botToken, this.config.proxyUrl);
    const info = await this.client.getMe();
    this.bot = new Bot({ token: this.config.botToken, info })
      .command("start", async (context) => {
        await this.handleStartCommand(context as any);
      })
      .on("message", async (context) => {
        await this.handleMessage(context as any);
      })
      .on("callback_query", async (context) => {
        await this.handleCallbackQuery(context as any);
      })
      .onError(({ kind, error }) => {
        console.error("[TelegramFeedbackRuntime] GramIO error:", kind, error);
      });

    this.pollGeneration += 1;
    const generation = this.pollGeneration;
    this.pollingAbortController = new AbortController();
    void this.runPollingLoop(generation, this.pollingAbortController.signal);
  }

  async stop(): Promise<void> {
    this.pollGeneration += 1;
    this.pollingAbortController?.abort();
    this.pollingAbortController = null;

    if (this.pendingRequest) {
      this.rejectPendingRequest(new Error("Telegram feedback runtime stopped."));
    }

    this.bot = null;
    this.client = null;
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async beginFeedbackRequest(params: BeginFeedbackRequestParams): Promise<FeedbackAwaiter> {
    await this.start();

    if (!this.client) {
      throw new Error("Telegram feedback runtime is not available.");
    }

    if (!this.config.boundChatId || !this.config.boundUserId) {
      throw new Error("Telegram user is not bound. Generate a verification code in settings and finish the binding flow first.");
    }

    if (this.pendingRequest) {
      throw new Error("Another Telegram feedback request is already pending. Finish or cancel it before creating a new one.");
    }

    const requestId = this.createRequestId();
    const now = Date.now();

    const request: TelegramFeedbackRequest = {
      requestId,
      sessionId: params.sessionId,
      toolCallId: params.toolCallId,
      question: params.question,
      allowImages: params.allowImages,
      submitButtonText: params.submitButtonText,
      createdAt: now,
      expiresAt: now + params.timeoutMs,
      status: "pending",
      replyCount: 0,
    };

    const prompt = [
      `Agent question:\n${params.question}`,
      "",
      params.allowImages
        ? "Reply in Telegram with text or images. When you are done, tap the inline button below."
        : "Reply in Telegram with text. When you are done, tap the inline button below.",
    ].join("\n");

    const sentMessage = await this.client.sendMessage({
      chat_id: this.config.boundChatId,
      text: prompt,
      reply_markup: {
        inline_keyboard: [[{ text: params.submitButtonText, callback_data: `tgf:submit:${requestId}` }]],
      },
    });

    const promise = new Promise<TelegramFeedbackResult>((resolve, reject) => {
      const timer = setTimeout(async () => {
        try {
          await this.client?.sendMessage({
            chat_id: this.config.boundChatId,
            text: "The pending feedback request timed out. Please start a new request from Obsidian if you still need to respond.",
          });
        } catch (error) {
          console.error("[TelegramFeedbackRuntime] Failed to send timeout notification:", error);
        }
        this.rejectPendingRequest(new Error("Telegram feedback timed out."), "timed-out");
      }, params.timeoutMs);

      this.pendingRequest = {
        request,
        sourceMessageId: sentMessage?.message_id,
        replies: [],
        timer,
        resolve,
        reject,
        notifyUpdate: params.onUpdate,
      };
    });

    return {
      requestId,
      promise,
      cancel: async (reason?: Error) => {
        this.rejectPendingRequest(reason ?? new Error("Telegram feedback cancelled."), "cancelled");
      },
    };
  }

  private shouldRun(): boolean {
    return this.config.enabled && this.config.botToken.trim().length > 0;
  }

  private getRuntimeSignature(config: TelegramFeedbackConfig): string {
    return JSON.stringify({
      enabled: config.enabled,
      botToken: config.botToken,
      proxyUrl: config.proxyUrl,
      pollingTimeoutSeconds: config.pollingTimeoutSeconds,
    });
  }

  private async runPollingLoop(generation: number, signal: AbortSignal): Promise<void> {
    while (generation === this.pollGeneration && !signal.aborted) {
      try {
        const updates = await this.client?.getUpdates(
          {
            offset: this.pollingOffset,
            timeout: this.config.pollingTimeoutSeconds,
            allowed_updates: ["message", "callback_query"],
          },
          signal,
        );

        if (!updates?.length) {
          continue;
        }

        for (const update of updates) {
          if (signal.aborted || generation !== this.pollGeneration) {
            return;
          }

          this.pollingOffset = update.update_id + 1;
          await this.bot?.updates.handleUpdate(update as any);
        }
      } catch (error) {
        if (signal.aborted || generation !== this.pollGeneration) {
          return;
        }
        console.error("[TelegramFeedbackRuntime] Polling failed:", error);
        await this.wait(1000);
      }
    }
  }

  private async handleStartCommand(context: any): Promise<void> {
    const chatId = this.extractChatId(context);
    if (!chatId || !this.client) {
      return;
    }

    const message = this.config.boundChatId === chatId
      ? "This Telegram account is already bound to Obsidian Agent. Future feedback requests will appear here."
      : this.isVerificationCodeActive()
      ? "Open Obsidian Agent settings, copy the current verification code, and send it here to bind this Telegram account."
      : "Open Obsidian Agent settings and generate a verification code to bind this Telegram account.";

    await this.client.sendMessage({
      chat_id: chatId,
      text: message,
    });
  }

  private async handleMessage(context: any): Promise<void> {
    const message = this.extractMessage(context);
    if (!message) {
      return;
    }

    const text = typeof message.text === "string" ? message.text.trim() : "";

    if (text && await this.tryBindUser(message, text)) {
      return;
    }

    await this.collectFeedbackReply(message);
  }

  private async handleCallbackQuery(context: any): Promise<void> {
    const callbackQuery = context?.callbackQuery ?? context?.update?.callback_query;
    const data = callbackQuery?.data;
    if (typeof data !== "string" || !data.startsWith("tgf:submit:")) {
      return;
    }

    const requestId = data.replace("tgf:submit:", "");
    if (!this.pendingRequest || this.pendingRequest.request.requestId !== requestId || !this.client) {
      await this.client?.answerCallbackQuery({
        callback_query_id: callbackQuery?.id,
        text: "This feedback request is no longer active.",
        show_alert: false,
      });
      return;
    }

    const fromId = callbackQuery?.from?.id;
    const chatId = callbackQuery?.message?.chat?.id;
    if (!this.isBoundUser(fromId, chatId)) {
      await this.client.answerCallbackQuery({
        callback_query_id: callbackQuery?.id,
        text: "This request belongs to a different Telegram account.",
        show_alert: true,
      });
      return;
    }

    try {
      await this.client.answerCallbackQuery({
        callback_query_id: callbackQuery?.id,
        text: "Feedback submitted.",
      });

      if (callbackQuery?.message?.message_id) {
        await this.client.editMessageReplyMarkup({
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          reply_markup: { inline_keyboard: [] },
        });
      }
    } catch (error) {
      console.error("[TelegramFeedbackRuntime] Failed to finalize callback query:", error);
    }

    await this.resolvePendingRequest();
  }

  private async tryBindUser(message: any, text: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    if (!/^\d{6,8}$/.test(text)) {
      return false;
    }

    if (!this.isVerificationCodeActive()) {
      await this.client.sendMessage({
        chat_id: message.chat.id,
        text: "The verification code is missing or expired. Generate a new one in Obsidian Agent settings.",
      });
      return true;
    }

    if (text !== this.config.verificationCode) {
      return false;
    }

    if (this.config.boundUserId && this.config.boundUserId !== message.from?.id) {
      await this.client.sendMessage({
        chat_id: message.chat.id,
        text: "This Obsidian Agent instance is already bound to another Telegram user.",
      });
      return true;
    }

    const nextConfig: TelegramFeedbackConfig = {
      ...this.config,
      verificationCode: "",
      verificationGeneratedAt: null,
      verificationExpiresAt: null,
      boundUserId: message.from?.id ?? null,
      boundChatId: message.chat?.id ?? null,
      boundUsername: message.from?.username ?? "",
      boundFirstName: message.from?.first_name ?? "",
      boundAt: Date.now(),
    };

    await this.persistConfig(nextConfig);

    await this.client.sendMessage({
      chat_id: message.chat.id,
      text: "Telegram binding completed. Future Obsidian Agent feedback requests will arrive here.",
    });
    return true;
  }

  private async collectFeedbackReply(message: any): Promise<void> {
    if (!this.pendingRequest || !this.pendingRequest.request.allowImages && !message.text && !message.caption) {
      return;
    }

    if (!this.isBoundUser(message.from?.id, message.chat?.id)) {
      return;
    }

    const imageFileIds = this.extractImageFileIds(message, this.pendingRequest.request.allowImages);
    const text = [message.text, message.caption].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join("\n\n");

    if (!text && imageFileIds.length === 0) {
      return;
    }

    const images = imageFileIds.length > 0 ? await this.downloadImages(imageFileIds) : [];

    this.pendingRequest.replies.push({
      messageId: message.message_id,
      text,
      imageFileIds,
      images,
      receivedAt: Date.now(),
    });
    this.pendingRequest.request.replyCount = this.pendingRequest.replies.length;

    await this.emitProgress(this.pendingRequest, {
      requestId: this.pendingRequest.request.requestId,
      question: this.pendingRequest.request.question,
      status: "pending",
      replies: [...this.pendingRequest.replies],
      imageCount: this.pendingRequest.replies.reduce((total, reply) => total + reply.imageFileIds.length, 0),
      username: this.config.boundUsername || undefined,
    });
  }

  private async resolvePendingRequest(): Promise<void> {
    if (!this.pendingRequest || !this.client) {
      return;
    }

    const active = this.pendingRequest;
    clearTimeout(active.timer);
    active.request.status = "submitted";

    const replies = [...active.replies];
    const pendingRequest = active.request;
    this.pendingRequest = null;

    const combinedText = replies
      .map((reply) => reply.text.trim())
      .filter((text) => text.length > 0)
      .join("\n\n");

    const imageFileIds = replies.flatMap((reply) => reply.imageFileIds);
    const images = replies.flatMap((reply) => reply.images ?? []);

    if (imageFileIds.length > 0) {
      await this.emitProgress(active, {
        requestId: pendingRequest.requestId,
        question: pendingRequest.question,
        status: "processing",
        replies,
        imageCount: imageFileIds.length,
        submittedAt: Date.now(),
        username: this.config.boundUsername || undefined,
      });
    }

    const imageAnalysis = images.length > 0
      ? await this.analyzeImages(images, combinedText)
      : imageFileIds.length > 0
      ? "Image analysis skipped because Telegram images could not be downloaded."
      : undefined;

    const result: TelegramFeedbackResult = {
      requestId: pendingRequest.requestId,
      question: pendingRequest.question,
      text: combinedText,
      imageCount: imageFileIds.length,
      imageAnalysis,
      submittedAt: Date.now(),
      replies,
      userId: this.config.boundUserId ?? 0,
      chatId: this.config.boundChatId ?? 0,
      username: this.config.boundUsername || undefined,
    };

    await this.client.sendMessage({
      chat_id: this.config.boundChatId,
      text: "Feedback received. Obsidian Agent can continue now.",
    });

    await this.emitProgress(active, {
      requestId: result.requestId,
      question: result.question,
      status: "completed",
      replies: result.replies,
      imageCount: result.imageCount,
      imageAnalysis: result.imageAnalysis,
      submittedAt: result.submittedAt,
      username: result.username,
    });

    active.resolve(result);
  }

  private rejectPendingRequest(error: Error, status: TelegramFeedbackRequest["status"] = "cancelled") {
    if (!this.pendingRequest) {
      return;
    }

    const active = this.pendingRequest;
    clearTimeout(active.timer);
    active.request.status = status;
    this.pendingRequest = null;
    active.reject(error);
  }

  private async analyzeImages(images: string[], collectedText: string): Promise<string | undefined> {
    if (images.length === 0) {
      return undefined;
    }

    const modelConfig = agentStore.getState().model ?? AIModelManager.getInstance().agentModelConfig;
    if (!modelConfig) {
      return "Image analysis skipped because no agent model is configured.";
    }

    const subAgent = new SubAgent(
      this.config.imageAnalysisSubagentName,
      IMAGE_ANALYSIS_SYSTEM_PROMPT,
      "Analyze Telegram feedback images",
      modelConfig,
    );

    const summaryPrompt = collectedText.trim().length > 0
      ? `The user already replied with this text:\n${collectedText}\n\nPlease analyze the attached Telegram images and produce a concise summary for the main agent.`
      : "Please analyze the attached Telegram feedback images and produce a concise summary for the main agent.";

    return await subAgent.query(
      new UserMessage(summaryPrompt, { images }),
      new AbortController().signal,
      () => undefined,
    );
  }

  private async downloadImages(fileIds: string[]): Promise<string[]> {
    if (!this.client || fileIds.length === 0) {
      return [];
    }

    const images: string[] = [];
    for (const fileId of fileIds) {
      try {
        const file = await this.client.getFile({ file_id: fileId });
        if (!file.file_path) {
          continue;
        }

        const bytes = await this.client.downloadFile(file.file_path);
        const mimeType = this.guessMimeType(file.file_path);
        images.push(`data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`);
      } catch (error) {
        console.error("[TelegramFeedbackRuntime] Failed to download image for display:", error);
      }
    }

    return images;
  }

  private async emitProgress(active: PendingFeedbackRequest, update: TelegramFeedbackProgress): Promise<void> {
    if (!active.notifyUpdate) {
      return;
    }

    try {
      await active.notifyUpdate(update);
    } catch (error) {
      console.error("[TelegramFeedbackRuntime] Failed to emit feedback progress:", error);
    }
  }

  private async persistConfig(config: TelegramFeedbackConfig): Promise<void> {
    this.config = { ...config };
    settingsStore.getState().setTelegramFeedbackConfig(config);
    await persistSettingsStore();
  }

  private extractMessage(context: any): any {
    return context?.message ?? context?.update?.message ?? null;
  }

  private extractChatId(context: any): number | null {
    return context?.chat?.id ?? context?.message?.chat?.id ?? context?.update?.message?.chat?.id ?? null;
  }

  private extractImageFileIds(message: any, allowImages: boolean): string[] {
    if (!allowImages) {
      return [];
    }

    const photos = Array.isArray(message.photo) ? message.photo : [];
    const photoFileId = photos.length > 0 ? photos[photos.length - 1]?.file_id : null;
    const documentFileId = message.document?.mime_type?.startsWith("image/") ? message.document.file_id : null;
    return [photoFileId, documentFileId].filter((value): value is string => typeof value === "string" && value.length > 0);
  }

  private isBoundUser(userId: number | undefined, chatId: number | undefined): boolean {
    return userId === this.config.boundUserId && chatId === this.config.boundChatId;
  }

  private isVerificationCodeActive(): boolean {
    return !!this.config.verificationCode && !!this.config.verificationExpiresAt && this.config.verificationExpiresAt > Date.now();
  }

  private guessMimeType(filePath: string): string {
    if (filePath.endsWith(".png")) {
      return "image/png";
    }
    if (filePath.endsWith(".webp")) {
      return "image/webp";
    }
    return "image/jpeg";
  }

  private createRequestId(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}