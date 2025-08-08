import { LangChainAssistantMessage, LangChainToolMessage, LangChainUserMessage, Message } from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Executes a function with token counting warnings suppressed
 * This can be used anywhere in the codebase where token counting warnings should be suppressed
 * @param fn The function to execute without token counting warnings
 * @returns The result of the function
 */
export async function withSuppressedTokenWarnings<T>(fn: () => Promise<T>): Promise<T> {
  // Store original console.warn
  const originalWarn = console.warn;

  try {
    // Replace with filtered version
    console.warn = function (...args) {
      // Ignore token counting warnings
      if (
        args[0]?.includes &&
        (args[0].includes("Failed to calculate number of tokens") ||
          args[0].includes("Unknown model"))
      ) {
        return;
      }
      // Pass through other warnings
      return originalWarn.apply(console, args);
    };

    // Execute the provided function
    return await fn();
  } finally {
    // Always restore original console.warn, even if an error occurs
    console.warn = originalWarn;
  }
}

export function ErrorMessage(content: string): Message {
  return {
    id: uuidv4(),
    role: "error",
    content,
    tool_calls: [],
    isStreaming: false,
  }
}

export function UserBaseMessageLike(message: Message): LangChainUserMessage {
  return {
    role: "user",
    content: message.content,
  }
}

export function AssistantBaseMessageLike(message: Message): LangChainAssistantMessage {
  return {
    role: "assistant",
    content: message.content,
    tool_calls: message.tool_calls || [],
  }
}

export function ToolBaseMessageLike(message: Message): LangChainToolMessage {
  return {
    role: "tool",
    content: message.content,
    name: message.name || "",
    tool_call_id: message.tool_call_id || "",
  }
}

// 全局App访问器
let globalApp: any = null;

export function setGlobalApp(app: any): void {
  globalApp = app;
}

export function getGlobalApp(): any {
	if (!globalApp) {
		throw new Error('Global app not set');
	}
	return globalApp;
}

export function clearGlobalApp(): void {
	globalApp = null;
}
