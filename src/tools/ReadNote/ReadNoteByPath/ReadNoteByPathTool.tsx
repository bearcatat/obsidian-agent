import { TFile, Vault } from "obsidian";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { DESCRIPTION } from "./prompts";
import { StructuredToolInterface } from "@langchain/core/tools";
import { MessageV2 } from "../../../types";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { getGlobalApp } from "@/utils";
import { ToolMessage } from "@/messages/tool-message";
import { createToolError } from "@/utils/error-utils";

export default class ReadNoteByPathTool {
  private static instance: ReadNoteByPathTool;
  private tool: StructuredToolInterface;
  private filePath: string;

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
    const app = getGlobalApp();
    const vault = app.vault;

    const file = vault.getAbstractFileByPath(filePath);
    if (!file || typeof file !== "object" || !("basename" in file) || !("path" in file)) {
      throw new Error(`文件不存在或不是笔记文件: 路径 "${filePath}" 对应的文件不存在或不是Markdown文件`);
    }

    try {
      const text = await vault.read(file as TFile);
      return ReadNoteByPathTool.genResult(file.basename as string, file.path as string, text);
    } catch (error) {
      console.error("ReadNoteByPath错误:", error);
      throw new Error(`读取文件时发生错误: ${error instanceof Error ? error.message : "未知错误"}`);
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

  async *run(toolCall: ToolCall): AsyncGenerator<MessageV2, void> {
    if (!toolCall.id) {
      console.error(`Tool call id is undefined`);
      return;
    }
    try {
      const toolMessage = ToolMessage.fromToolCall(toolCall);
      this.filePath = toolCall.args.filePath;
      const result = await this.tool.invoke(toolCall.args);
      toolMessage.setContent(result);
      toolMessage.setChildren(this.render());
      toolMessage.close();
      yield toolMessage;
    } catch (error) {
      yield createToolError(toolCall, error as string, { filePath: toolCall.args.filePath });
    }
  }

  private render(): React.ReactNode {
    return (
      `Read note by path: ${this.filePath}`
    )
  }
}
