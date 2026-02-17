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
