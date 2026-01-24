import { TFile, Vault } from "obsidian";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { DESCRIPTION } from "./prompts";
import { StructuredToolInterface } from "@langchain/core/tools";
import { MessageV2, FileEdit } from "@/types";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { getGlobalApp } from "@/utils";
import { ToolMessage } from "@/messages/tool-message";
import { createToolError } from "@/utils/error-utils";
import { FileEditToolMessageCard } from "@/ui/components/agent-view/messages/message/file-edit-tool-message-card";

export default class FileEditTool {
  private static instance: FileEditTool;
  private tool: StructuredToolInterface;

  static getInstance(): FileEditTool {
    if (!FileEditTool.instance) {
      FileEditTool.instance = new FileEditTool();
    }
    return FileEditTool.instance;
  }

  private constructor() {
    this.tool = tool(this.editFile, {
      name: "editFile",
      description: DESCRIPTION,
      schema: z.object({
        file_path: z.string().describe("要修改笔记的路径（相对于 vault 根目录，例如：'项目/文档/README.md'）"),
        old_string: z.string().describe("要替换的文本（在笔记中必须是唯一的，创建新笔记时为空）"),
        new_string: z.string().describe("用于替换 old_string 的编辑后文本"),
      }),
    });
  }

  private async editFile({ file_path, old_string, new_string }: { file_path: string; old_string: string; new_string: string }): Promise<string> {
    return "success";
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
      const app = getGlobalApp();
      const vault = app.vault;
      const { file_path, old_string, new_string } = toolCall.args as { file_path: string; old_string: string; new_string: string };

      // 处理路径：Obsidian 使用相对于 vault 根目录的路径，使用正斜杠分隔
      // 如果传入的是绝对路径，尝试转换为相对路径
      let relativePath = file_path.replace(/\\/g, '/'); // 统一使用正斜杠
      
      // 如果路径以 / 开头或者是 Windows 绝对路径（如 C:\），尝试转换为相对路径
      if (relativePath.startsWith('/') || /^[A-Za-z]:/.test(relativePath)) {
        try {
          // 尝试获取 vault 根目录路径
          const vaultPath = (vault.adapter as any).basePath || '';
          if (vaultPath && (file_path.startsWith(vaultPath) || relativePath.startsWith(vaultPath.replace(/\\/g, '/')))) {
            // 移除 vault 根目录前缀
            relativePath = relativePath.replace(vaultPath.replace(/\\/g, '/'), '').replace(/^\/+/, '');
          } else if (relativePath.startsWith('/')) {
            // 如果只是以 / 开头，移除开头的斜杠
            relativePath = relativePath.replace(/^\/+/, '');
          }
        } catch (e) {
          // 如果转换失败，使用原始路径（去除开头的斜杠）
          relativePath = relativePath.replace(/^\/+/, '');
        }
      }

      // 判断是创建新文件还是编辑现有文件
      const isNewFile = !old_string || old_string.trim() === '';
      const file = vault.getAbstractFileByPath(relativePath) as TFile | null;

      let oldContent = '';
      let newContent = '';

      if (isNewFile) {
        // 创建新文件
        newContent = new_string;
      } else {
        // 编辑现有文件
        if (!file) {
          yield createToolError(toolCall, "文件不存在", { 
            details: `路径 "${relativePath}" 对应的文件不存在`,
            filePath: relativePath 
          }, "not_found");
          return;
        }

        try {
          oldContent = await vault.read(file);
        } catch (error) {
          yield createToolError(toolCall, "读取文件失败", { 
            details: error instanceof Error ? error.message : "未知错误",
            filePath: relativePath 
          }, "runtime");
          return;
        }

        // 验证 old_string 的唯一性
        const occurrences = (oldContent.match(new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (occurrences === 0) {
          yield createToolError(toolCall, "old_string 不匹配", { 
            details: `在文件中找不到匹配的 old_string`,
            filePath: relativePath 
          }, "validation");
          return;
        }
        if (occurrences > 1) {
          yield createToolError(toolCall, "old_string 不唯一", { 
            details: `old_string 在文件中出现了 ${occurrences} 次，必须唯一`,
            filePath: relativePath,
            occurrences
          }, "validation");
          return;
        }

        // 计算新内容
        newContent = oldContent.replace(old_string, new_string);
      }

      // 用户确认交互
      let resolver: (value: "apply" | "reject") => void;
      const waitForDecision = () => {
        return new Promise<"apply" | "reject">((resolve) => {
          resolver = resolve;
        });
      };

      const handleApply = () => {
        resolver("apply");
      };

      const handleReject = () => {
        resolver("reject");
      };

      const fileEdit: FileEdit = {
        id: toolCall.id,
        file_path: relativePath,
        old_string: old_string,
        new_string: new_string,
        old_content: oldContent || undefined,
        new_content: newContent,
      };

      const toolMessage = ToolMessage.fromToolCall(toolCall);
      toolMessage.setChildren(this.render(fileEdit, false, null, handleApply, handleReject));
      yield toolMessage;

      // 等待用户决策
      const decision = await waitForDecision();

      if (decision === "apply") {
        try {
          if (isNewFile) {
            // 创建新文件
            // 确保目录存在
            const dirPath = relativePath.substring(0, relativePath.lastIndexOf('/'));
            if (dirPath && dirPath !== '.' && dirPath !== '') {
              const dirExists = await vault.adapter.exists(dirPath);
              if (!dirExists) {
                await vault.adapter.mkdir(dirPath);
              }
            }
            await vault.create(relativePath, newContent);
            toolMessage.setContent(JSON.stringify({
              success: true,
              message: `文件 "${relativePath}" 已创建`,
            }));
          } else {
            // 编辑现有文件
            if (!file) {
              throw new Error("文件不存在");
            }
            await vault.process(file, (content: string) => {
              return content.replace(old_string, new_string);
            });
            toolMessage.setContent(JSON.stringify({
              success: true,
              message: `文件 "${relativePath}" 已更新`,
            }));
          }
        } catch (error) {
          toolMessage.setContent(JSON.stringify({
            error: "文件操作失败",
            details: error instanceof Error ? error.message : "未知错误",
          }));
        }
      } else {
        // 用户拒绝
        toolMessage.setContent(JSON.stringify({
          cancelled: true,
          message: "用户拒绝了文件编辑",
        }));
      }

      toolMessage.setChildren(this.render(fileEdit, true, decision, handleApply, handleReject));
      toolMessage.close();
      yield toolMessage;
    } catch (error) {
      yield createToolError(toolCall, error instanceof Error ? error.message : "未知错误");
    }
  }

  private render(
    fileEdit: FileEdit,
    origin_answered_state: boolean,
    decision: "apply" | "reject" | null,
    onApply: () => void,
    onReject: () => void
  ): React.ReactNode {
    return (
      <FileEditToolMessageCard
        fileEdit={fileEdit}
        origin_answered_state={origin_answered_state}
        decision={decision}
        onApply={onApply}
        onReject={onReject}
      />
    );
  }
}
