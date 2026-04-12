import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { URL } from "url";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

interface TelegramApiEnvelope<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export interface TelegramApiUpdate {
  update_id: number;
  message?: any;
  callback_query?: any;
}

export interface TelegramApiFile {
  file_id: string;
  file_path?: string;
}

export interface TelegramApiUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

type RequestBody = Record<string, unknown> | undefined;

export default class TelegramApiClient {
  private baseUrl: string;
  private proxyUrl: string;
  private token: string;
  private agentCache = new Map<string, any>();

  constructor(token: string, proxyUrl: string, baseUrl: string = "https://api.telegram.org") {
    this.token = token;
    this.proxyUrl = proxyUrl;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  updateConfig(token: string, proxyUrl: string, baseUrl: string = this.baseUrl) {
    this.token = token;
    this.proxyUrl = proxyUrl;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.agentCache.clear();
  }

  async getUpdates(params: Record<string, unknown>, signal?: AbortSignal): Promise<TelegramApiUpdate[]> {
    return await this.call("getUpdates", params, signal);
  }

  async getMe(signal?: AbortSignal): Promise<TelegramApiUser> {
    return await this.call("getMe", undefined, signal);
  }

  async sendMessage(params: Record<string, unknown>, signal?: AbortSignal): Promise<any> {
    return await this.call("sendMessage", params, signal);
  }

  async answerCallbackQuery(params: Record<string, unknown>, signal?: AbortSignal): Promise<boolean> {
    return await this.call("answerCallbackQuery", params, signal);
  }

  async editMessageReplyMarkup(params: Record<string, unknown>, signal?: AbortSignal): Promise<any> {
    return await this.call("editMessageReplyMarkup", params, signal);
  }

  async getFile(params: Record<string, unknown>, signal?: AbortSignal): Promise<TelegramApiFile> {
    return await this.call("getFile", params, signal);
  }

  async downloadFile(filePath: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const normalizedPath = filePath.replace(/^\/+/, "");
    const url = new URL(`${this.baseUrl}/file/bot${this.token}/${normalizedPath}`);
    return await this.requestArrayBuffer(url, signal);
  }

  private async call<T>(method: string, params?: RequestBody, signal?: AbortSignal): Promise<T> {
    const url = new URL(`${this.baseUrl}/bot${this.token}/${method}`);
    const response = await this.requestJson<TelegramApiEnvelope<T>>(url, params, signal);

    if (!response.ok) {
      throw new Error(`Telegram API error (${response.error_code ?? "unknown"}): ${response.description ?? "Unknown error"}`);
    }

    return response.result as T;
  }

  private async requestJson<T>(url: URL, body?: RequestBody, signal?: AbortSignal): Promise<T> {
    const payload = body ? JSON.stringify(body) : undefined;
    const response = await this.request(url, payload, signal);
    const text = response.buffer.toString("utf8");

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`Failed to parse Telegram response: ${text}`);
    }
  }

  private async requestArrayBuffer(url: URL, signal?: AbortSignal): Promise<ArrayBuffer> {
    const response = await this.request(url, undefined, signal, {
      Accept: "application/octet-stream",
    });
    return Uint8Array.from(response.buffer).buffer;
  }

  private async request(
    url: URL,
    payload?: string,
    signal?: AbortSignal,
    extraHeaders?: Record<string, string>,
  ): Promise<{ buffer: Buffer; statusCode: number }> {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const agent = this.getAgent(url);

    return await new Promise((resolve, reject) => {
      const request = transport(
        url,
        {
          method: payload ? "POST" : "GET",
          agent,
          headers: {
            ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload).toString() } : {}),
            ...extraHeaders,
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on("end", () => {
            const buffer = Buffer.concat(chunks);
            if ((response.statusCode ?? 500) >= 400) {
              reject(new Error(`Telegram HTTP ${response.statusCode}: ${buffer.toString("utf8")}`));
              return;
            }
            resolve({ buffer, statusCode: response.statusCode ?? 200 });
          });
        },
      );

      const abort = () => {
        request.destroy(new Error("Telegram request aborted"));
      };

      if (signal) {
        if (signal.aborted) {
          abort();
          return;
        }
        signal.addEventListener("abort", abort, { once: true });
      }

      request.on("error", (error) => {
        reject(error);
      });

      if (payload) {
        request.write(payload);
      }

      request.end();
    });
  }

  private getAgent(targetUrl: URL): any {
    if (!this.proxyUrl.trim()) {
      return undefined;
    }

    const cacheKey = `${targetUrl.protocol}:${this.proxyUrl}`;
    const cached = this.agentCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let agent: any;
    if (this.proxyUrl.startsWith("socks://") || this.proxyUrl.startsWith("socks4://") || this.proxyUrl.startsWith("socks5://")) {
      agent = new SocksProxyAgent(this.proxyUrl);
    } else if (targetUrl.protocol === "https:") {
      agent = new HttpsProxyAgent(this.proxyUrl);
    } else {
      agent = new HttpProxyAgent(this.proxyUrl);
    }

    this.agentCache.set(cacheKey, agent);
    return agent;
  }
}