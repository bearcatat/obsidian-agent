import { tool } from "ai";
import { z } from "zod";
import { ToolMessage } from "@/messages/tool-message";
import { MessageV2, TelegramFeedbackProgress } from "@/types";
import { DESCRIPTION } from "./prompts";
import TelegramFeedbackRuntime from "./TelegramFeedbackRuntime";
import { agentStore } from "@/state/agent-state-impl";
import { renderTelegramFeedbackMessage } from "@/ui/components/agent-view/messages/message/telegram-feedback-message-card";

export const toolName = "telegramFeedback";

export const TelegramFeedbackTool = tool({
  title: toolName,
  description: DESCRIPTION,
  inputSchema: z.object({
    question: z.string().min(1).describe("The question or feedback request to send to the bound Telegram user."),
    timeoutMs: z.number().min(10_000).max(60 * 60 * 1000).optional().describe("How long to wait for Telegram feedback before timing out."),
    submitButtonText: z.string().min(1).max(32).optional().describe("Inline button text used to finish the feedback flow."),
  }),
  execute: async ({ question, timeoutMs, submitButtonText }, { toolCallId, experimental_context, abortSignal }) => {
    const context = experimental_context as { addMessage: (message: MessageV2) => void };

    try {
      const runtime = TelegramFeedbackRuntime.getInstance();
      const config = runtime.getConfig();
      if (!config.enabled || !config.botToken.trim()) {
        throw new Error("Telegram feedback is not configured or enabled. Open settings and configure the Telegram tool first.");
      }

      const toolMessage = ToolMessage.from(toolName, toolCallId);
      let progress: TelegramFeedbackProgress = createPendingProgress(question);
      toolMessage.setChildren(renderTelegramFeedbackMessage(progress));
      context.addMessage(toolMessage);

      const updateProgress = (nextProgress: TelegramFeedbackProgress) => {
        progress = nextProgress;
        toolMessage.setChildren(renderTelegramFeedbackMessage(progress));
        context.addMessage(toolMessage);
      };

      const awaiter = await runtime.beginFeedbackRequest({
        question,
        timeoutMs: timeoutMs ?? config.feedbackTimeoutMs,
        submitButtonText: submitButtonText ?? "结束反馈",
        sessionId: agentStore.getState().sessionId,
        toolCallId,
        onUpdate: updateProgress,
      });

      updateProgress({ ...progress, requestId: awaiter.requestId });

      const abortHandler = async () => {
        await awaiter.cancel(new Error("Telegram feedback request was aborted."));
      };

      abortSignal?.addEventListener("abort", abortHandler, { once: true });
      const result = await awaiter.promise;
      abortSignal?.removeEventListener("abort", abortHandler);

      const payload = {
        toolName,
        requestId: result.requestId,
        question: result.question,
        status: "completed" as const,
        text: result.text,
        imageCount: result.imageCount,
        imageAnalysis: result.imageAnalysis,
        submittedAt: result.submittedAt,
        username: result.username,
        replies: result.replies,
      };

      toolMessage.setContent(JSON.stringify(payload));
      toolMessage.setChildren(renderTelegramFeedbackMessage(payload));
      toolMessage.close();
      context.addMessage(toolMessage);

      return JSON.stringify(payload);
    } catch (error) {
      const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error);
      context.addMessage(errorMessage);
      throw error;
    }
  },
});

function createPendingProgress(question: string): TelegramFeedbackProgress {
  return {
    requestId: "",
    question,
    status: "pending",
    replies: [],
    imageCount: 0,
  };
}