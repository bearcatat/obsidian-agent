import { TFile, Vault } from "obsidian";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { DESCRIPTION } from "./prompts";
import { StructuredToolInterface } from "@langchain/core/tools";
import { Message } from "../../../types";
import { v4 as uuidv4 } from "uuid";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { ErrorMessage, getGlobalApp } from "@/utils";

export default class ReadNoteByPathTool {
  private static instance: ReadNoteByPathTool;
  private tool: StructuredToolInterface;

  static getInstance(): ReadNoteByPathTool {
    if (!ReadNoteByPathTool.instance) {
      ReadNoteByPathTool.instance = new ReadNoteByPathTool();
    }
    return ReadNoteByPathTool.instance;
  }

  private constructor() {
    this.tool = tool(this.readNoteByPath, {
      name: "readNoteByPath",
      description: DESCRIPTION,
      schema: z.object({
        filePath: z.string().describe("笔记文件的路径，例如：'项目/文档/README.md'"),
      }),
    });
  }

  private async readNoteByPath({ filePath }: { filePath: string }): Promise<string> {
    try {
      const app = getGlobalApp();
      const vault = app.vault;

      const file = vault.getAbstractFileByPath(filePath);
      if (file && typeof file === "object" && "basename" in file && "path" in file) {
        const text = await vault.read(file as TFile);
        return ReadNoteByPathTool.genResult(file.basename as string, file.path as string, text);
      }
      return JSON.stringify({
        error: "文件不存在或不是笔记文件",
        details: `路径 "${filePath}" 对应的文件不存在或不是Markdown文件`,
      });
    } catch (error) {
      console.error("ReadNoteByPath错误:", error);
      return JSON.stringify({
        error: "读取文件时发生错误",
        details: error instanceof Error ? error.message : "未知错误",
      });
    }
  }

  private static genResult(fileName: string, path: string, content: string): string {
    return `<metadata>
title: ${fileName}
note path: ${path}
</metadata>
<content>
${content}
</content>`;
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
        call_tool_msg: `读取笔记: ${toolCall.args.filePath}`,
      };
    } catch (error) {
      yield ErrorMessage(error as string);
    }
  }
}
