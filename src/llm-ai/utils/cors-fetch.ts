import { requestUrl, RequestUrlParam, RequestUrlResponse } from "obsidian";

/**
 * 创建一个兼容 fetch API 的适配器，使用 Obsidian 的 requestUrl 绕过 CORS
 */
export function createCORSFetchAdapter(): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();
        
        // 将 RequestInit 转换为 RequestUrlParam
        const requestParam: RequestUrlParam = {
            url,
            method: init?.method || "POST",
            headers: init?.headers as Record<string, string>,
            body: init?.body as string,
        };

        try {
            const response: RequestUrlResponse = await requestUrl(requestParam);
            
            // 将 RequestUrlResponse 转换为 Response 对象
            return {
                ok: response.status >= 200 && response.status < 300,
                status: response.status,
                statusText: getStatusText(response.status),
                headers: new Headers(response.headers),
                url: url,
                json: async () => response.json,
                text: async () => response.text,
                blob: async () => new Blob([response.text]),
                arrayBuffer: async () => new TextEncoder().encode(response.text).buffer,
                clone: function() { return this; },
                body: null,
                bodyUsed: true,
                type: "basic",
                redirected: false,
                redirect: async () => this,
                formData: async () => { throw new Error("formData not supported"); },
            } as unknown as Response;
        } catch (error) {
            // 如果 requestUrl 失败，抛出网络错误
            throw new Error(`Network error: ${error}`);
        }
    };
}

/**
 * 创建一个伪流式 fetch 适配器，用于 CORS 环境下无法直接流式传输的情况
 * 使用非流式请求获取完整响应，然后按 reasoning -> content -> tool 的顺序模拟 SSE 流输出
 */
export function createOpenAICORSPseudoStreamFetchAdapter(): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();
        
        // 解析并修改请求体，强制设为非流式
        let bodyObj: any = {};
        if (init?.body) {
            try {
                bodyObj = JSON.parse(init.body as string);
            } catch {
                bodyObj = {};
            }
        }
        // 强制设置为非流式
        bodyObj.stream = false;
        
        // 将 RequestInit 转换为 RequestUrlParam
        const requestParam: RequestUrlParam = {
            url,
            method: init?.method || "POST",
            headers: init?.headers as Record<string, string>,
            body: JSON.stringify(bodyObj),
        };

        try {
            const response: RequestUrlResponse = await requestUrl(requestParam);
            
            // 解析完整的响应
            const data = response.json;
            const id = data.id || `cors-${Date.now()}`;
            const model = data.model || "unknown";
            const created = data.created || Math.floor(Date.now() / 1000);
            
            // 提取消息内容
            const message = data.choices?.[0]?.message || {};
            const reasoningContent = message.reasoning_content || "";
            const content = message.content || "";
            const toolCalls = message.tool_calls || [];
            
            // 创建伪流式响应
            const stream = createPseudoStream({
                id,
                model,
                created,
                reasoningContent,
                content,
                toolCalls,
            });
            
            return new Response(stream, {
                status: 200,
                statusText: "OK",
                headers: new Headers({
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                }),
            });
        } catch (error) {
            throw new Error(`Network error: ${error}`);
        }
    };
}

interface PseudoStreamOptions {
    id: string;
    model: string;
    created: number;
    reasoningContent: string;
    content: string;
    toolCalls: any[];
}

function createPseudoStream(options: PseudoStreamOptions): ReadableStream<Uint8Array> {
    const { id, model, created, reasoningContent, content, toolCalls } = options;
    const encoder = new TextEncoder();
    const chunkSize = 100; // 每个 chunk 的字符数
    
    return new ReadableStream({
        start(controller) {
            let index = 0;
            
            // 辅助函数：创建 SSE chunk
            const createSSEChunk = (delta: any) => {
                const chunk = {
                    id,
                    object: "chat.completion.chunk",
                    created,
                    model,
                    choices: [{
                        index: 0,
                        delta,
                        finish_reason: null,
                    }],
                };
                return `data: ${JSON.stringify(chunk)}\n\n`;
            };
            
            // 发送 reasoning content
            if (reasoningContent) {
                for (let i = 0; i < reasoningContent.length; i += chunkSize) {
                    const chunk = reasoningContent.slice(i, i + chunkSize);
                    controller.enqueue(encoder.encode(createSSEChunk({
                        role: "assistant",
                        reasoning_content: chunk,
                    })));
                }
            }
            
            // 发送 content
            if (content) {
                for (let i = 0; i < content.length; i += chunkSize) {
                    const chunk = content.slice(i, i + chunkSize);
                    controller.enqueue(encoder.encode(createSSEChunk({
                        content: chunk,
                    })));
                }
            }
            
            // 发送 tool calls
            if (toolCalls && toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                    controller.enqueue(encoder.encode(createSSEChunk({
                        tool_calls: [toolCall],
                    })));
                }
            }
            
            // 发送完成标记
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
        },
    });
}

function getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
        200: "OK",
        201: "Created",
        204: "No Content",
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        500: "Internal Server Error",
        502: "Bad Gateway",
        503: "Service Unavailable",
    };
    return statusTexts[status] || "Unknown";
}
