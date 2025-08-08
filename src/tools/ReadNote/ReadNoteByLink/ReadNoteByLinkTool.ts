import { MetadataCache, Vault, getLinkpath } from "obsidian";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { DESCRIPTION } from "./prompts";
import { StructuredToolInterface } from "@langchain/core/tools";
import { Message } from "../../../types";
import { v4 as uuidv4 } from "uuid";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { ErrorMessage, getGlobalApp } from "@/utils";

export default class ReadNoteByLinkTool {
  private static instance: ReadNoteByLinkTool;
  private tool: StructuredToolInterface;

  static getInstance(): ReadNoteByLinkTool {
    if (!ReadNoteByLinkTool.instance) {
      ReadNoteByLinkTool.instance = new ReadNoteByLinkTool();
    }
    return ReadNoteByLinkTool.instance;
  }

  private constructor() {
    this.tool = tool(this.readNoteByLink, {
      name: "readNoteByLink",
      description: DESCRIPTION,
      schema: z.object({
        linkPath: z.string().describe("笔记链接路径，例如：'项目计划'"),
        filePath: z.string().describe("当前笔记的完整路径"),
      }),
    });
  }

  private async readNoteByLink({ linkPath, filePath }: { linkPath: string; filePath: string }): Promise<string> {
    try {
      const app = getGlobalApp();
      const metadataCache = app.metadataCache;
      const vault = app.vault;

      const linkedNote = metadataCache.getFirstLinkpathDest(getLinkpath(linkPath), filePath);
      if (linkedNote) {
        const fileName = linkedNote.basename;
        const path = linkedNote.path;
        const text = await vault.read(linkedNote);
        return ReadNoteByLinkTool.genResult(fileName, path, linkPath, text);
      }
      return JSON.stringify({
        error: "链接笔记不存在",
        details: `链接 "${linkPath}" 对应的笔记不存在`,
      });
    } catch (error) {
      console.error("ReadNoteByLink错误:", error);
      return JSON.stringify({
        error: "读取链接笔记时发生错误",
        details: error instanceof Error ? error.message : "未知错误",
      });
    }
  }

  private static genResult(fileName: string, path: string, linkPath: string, content: string): string {
    return `title: ${fileName}
note path: ${path}
link path: ${linkPath}

${content}
`;
  }

  getTool(): StructuredToolInterface {
    return this.tool;
  }

  async *run(toolCall: ToolCall): AsyncGenerator<Message, void> {
    if (!toolCall.id) {
      console.error(`Tool call id is undefined`);
      return;
    }
    try {
      const result = await this.tool.invoke(toolCall.args);
      yield {
        id: uuidv4(),
        content: result,
        role: "tool",
        name: this.tool.name,
        tool_call_id: toolCall.id,
        isStreaming: false,
        call_tool_msg: `读取链接笔记: ${toolCall.args.linkPath}`,
      };
    } catch (error) {
      yield ErrorMessage(error as string);
    }
  }
}
