import type { ReactNode } from "react";
import { AssistantMessage } from "@/messages/assistant-message";
import { ToolMessage } from "@/messages/tool-message";
import { UserMessage } from "@/messages/user-message";
import type { CursorPosition, MessageV2, TokenUsage } from "@/types";

export type SerializedHistoryMessage =
  | {
      id: string;
      role: "user";
      content: string;
      context?: {
        images?: string[];
        cursorPosition?: CursorPosition;
      };
    }
  | {
      id: string;
      role: "assistant";
      content: string;
      reasoning_content?: string;
      usage?: TokenUsage;
    }
  | {
      id: string;
      role: "tool";
      name: string;
      tool_call_id: string;
      content: string;
      isError?: boolean;
      errorDetails?: Record<string, unknown>;
      errorType?: string;
    };

export function serializeMessagesForHistory(messages: MessageV2[]): SerializedHistoryMessage[] {
  return messages
    .map(serializeMessageForHistory)
    .filter((message): message is SerializedHistoryMessage => message !== null);
}

export function serializeMessageForHistory(message: MessageV2): SerializedHistoryMessage | null {
  if (message.role === "user") {
    const userMessage = message as UserMessage;
    return {
      id: userMessage.id,
      role: "user",
      content: userMessage.content,
      context: userMessage.context
        ? {
            images: userMessage.context.images || [],
            cursorPosition: userMessage.context.cursorPosition,
          }
        : undefined,
    };
  }

  if (message.role === "assistant") {
    const assistantMessage = message as AssistantMessage;
    return {
      id: assistantMessage.id,
      role: "assistant",
      content: assistantMessage.content,
      reasoning_content: assistantMessage.reasoning_content,
      usage: assistantMessage.usage,
    };
  }

  if (message.role === "tool") {
    const toolMessage = message as ToolMessage;
    return {
      id: toolMessage.id,
      role: "tool",
      name: toolMessage.name,
      tool_call_id: toolMessage.tool_call_id,
      content: toolMessage.content,
      isError: toolMessage.isError,
      errorDetails: toolMessage.errorDetails,
      errorType: toolMessage.errorType,
    };
  }

  return null;
}

export function deserializeMessageForHistory(
  data: SerializedHistoryMessage,
  renderToolChildren: (toolName: string, content: string) => ReactNode,
): MessageV2 | null {
  if (data.role === "user") {
    const message = new UserMessage(data.content, data.context ? {
      images: data.context.images || [],
      cursorPosition: data.context.cursorPosition,
    } : null);
    message.id = data.id;
    return message;
  }

  if (data.role === "assistant") {
    const message = AssistantMessage.createEmpty(getAssistantBaseId(data.id));
    message.id = data.id;
    message.content = data.content;
    message.reasoning_content = data.reasoning_content || "";
    message.usage = data.usage;
    message.isStreaming = false;
    return message;
  }

  if (data.role === "tool") {
    const message = ToolMessage.from(data.name, data.tool_call_id || "");
    message.id = data.id;
    message.content = data.content || "";
    message.isError = Boolean(data.isError);
    message.errorDetails = data.errorDetails;
    message.errorType = data.errorType;
    message.isStreaming = false;

    if (!message.isError && message.content) {
      message.setChildren(renderToolChildren(message.name, message.content));
    }

    return message;
  }

  return null;
}

function getAssistantBaseId(id: string): string {
  return id.endsWith("-assistant") ? id.slice(0, -"-assistant".length) : id;
}
