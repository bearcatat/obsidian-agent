import { ToolCall } from "@langchain/core/dist/messages/tool";
import { ToolMessage } from "@/messages/tool-message";

export type ErrorType = 
  | "validation"    // 输入验证失败
  | "runtime"       // 运行时异常
  | "permission"    // 权限问题
  | "network"       // 网络/外部服务
  | "configuration" // 配置问题
  | "not_found"     // 资源不存在

/**
 * 创建工具错误消息
 * @param toolCall 工具调用信息
 * @param error 错误描述或Error对象
 * @param details 结构化错误详情
 * @param errorType 错误类型
 * @returns 错误ToolMessage
 */
export function createToolError(
  toolCall: ToolCall,
  error: string | Error,
  details?: Record<string, any>,
  errorType?: ErrorType
): ToolMessage {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorDetails = {
    ...details,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  };

  return ToolMessage.createErrorToolMessage(
    toolCall,
    errorMessage,
    errorDetails,
    errorType || "runtime"
  );
}

/**
 * 统一工具错误处理函数
 * @param error 未知错误
 * @param toolCall 工具调用信息
 * @param context 错误上下文信息
 * @returns 错误ToolMessage
 */
export function handleToolError(
  error: unknown,
  toolCall: ToolCall,
  context?: Record<string, any>
): ToolMessage {
  console.error(`Tool ${toolCall.name} error:`, error);
  
  if (error instanceof Error) {
    return createToolError(
      toolCall,
      error,
      { ...context, originalError: error.name },
      determineErrorType(error, context)
    );
  }
  
  return createToolError(
    toolCall,
    String(error),
    context,
    "runtime"
  );
}

/**
 * 根据错误和上下文确定错误类型
 */
function determineErrorType(error: Error, context?: Record<string, any>): ErrorType {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  
  if (name.includes("permission") || message.includes("permission") || message.includes("access")) {
    return "permission";
  }
  
  if (name.includes("validation") || message.includes("invalid") || message.includes("valid") ||
      message.includes("不匹配") || // doesn't match
      message.includes("不唯一") || // not unique
      message.includes("匹配") || // match (for "找不到匹配")
      message.includes("验证") || // validation
      message.includes("无效")) { // invalid
    return "validation";
  }
  
  if (name.includes("network") || message.includes("network") || message.includes("http") || message.includes("fetch")) {
    return "network";
  }
  
  if (message.includes("not found") || message.includes("不存在")) {
    return "not_found";
  }
  
  if (message.includes("configuration") || message.includes("config")) {
    return "configuration";
  }
  
  return "runtime";
}

/**
 * 检查消息是否为错误工具消息
 */
export function isErrorToolMessage(message: any): message is ToolMessage & { isError: true } {
  return message && 
         message.role === "tool" && 
         (message as any).isError === true;
}

/**
 * 从错误内容中提取结构化错误信息
 */
export function parseErrorContent(content: string): {
  error?: string;
  details?: Record<string, any>;
  type?: string;
  isError: boolean;
} {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && parsed._isError) {
      return {
        error: parsed.error,
        details: parsed.details,
        type: parsed.type,
        isError: true
      };
    }
  } catch {
    // 不是JSON格式，检查是否包含错误关键词
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes("error") || 
        lowerContent.includes("失败") || 
        lowerContent.includes("错误") ||
        lowerContent.includes("exception")) {
      return {
        error: content,
        isError: true
      };
    }
  }
  
  return { isError: false };
}