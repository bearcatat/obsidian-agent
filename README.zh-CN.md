# Obsidian Agent

> **UI代码部分源于 [@logancyang/obsidian-copilot](https://github.com/logancyang/obsidian-copilot) 项目**

一个强大的 Obsidian 插件，集成了 AI 助手功能，帮助您更高效地管理和使用您的笔记。

[English Documentation](./README.md)

## ✨ 功能特性

### 🤖 AI 聊天助手
- **智能对话**: 基于配置的 AI 模型进行自然语言对话
- **上下文感知**: 自动获取当前笔记和上下文笔记内容
- **多模型支持**: 支持 DeepSeek、OpenAI、Anthropic、月之暗面等多种模型

### 🛠️ 工具生态系统
- **内置工具**: 
  - 时间工具：获取当前时间信息，支持时间范围查询
  - 笔记读取：通过路径或链接读取笔记内容（支持 `[[笔记名称]]` 格式）
  - 提问工具：AI 助手可以向用户提问，提供多个选项供用户选择，实现交互式对话
- **MCP 服务器**: 支持 Model Context Protocol 服务器，扩展自定义工具
- **SubAgent 子代理**: 创建专门的AI助手，处理特定任务和领域
- **工具管理**: 灵活启用/禁用各种工具，支持工具权限配置

### ⚙️ 灵活的配置系统
- **模型配置**: 可配置 API 密钥、基础 URL、温度、最大令牌数等参数
- **设置持久化**: 所有配置自动保存到本地，重启后生效

## 🎯 核心功能详解

### SubAgent 子代理系统
SubAgent 允许您创建专门的 AI 助手，每个子代理都有：
- **专属系统提示**: 定义子代理的专业领域和行为
- **独立模型配置**: 为不同任务选择最适合的AI模型
- **工具权限管理**: 精确控制子代理可使用的工具
- **独立对话历史**: 每个子代理维护独立的对话上下文

**使用场景**：
- 创建专门用于网页搜索的助手，你可以为它搭配[playwright-mcp](https://github.com/microsoft/playwright-mcp)和[bocha-search-mcp](https://github.com/BochaAI/bocha-search-mcp)工具
- 创建专门用于判断笔记是否存在疏漏的助手

### MCP 服务器集成
通过 Model Context Protocol 扩展插件功能：
- **协议支持**: 支持stdio、http和sse三种协议
- **服务器管理**: 支持添加、编辑、删除 MCP 服务器配置
- **工具发现**: 自动发现和注册 MCP 服务器提供的工具
- **权限控制**: 可单独管理每个 MCP 服务器的工具启用状态

## 📖 使用指南

### 启动 AI 助手
- 点击左侧边栏的 Obsidian Agent 图标
- 或使用命令面板搜索 "Obsidian Agent"

### 与 AI 对话
1. 在聊天界面输入您的问题
2. AI 会自动分析当前笔记和上下文
3. 根据需要调用相关工具获取信息
4. 获得智能回复和建议

### 工具使用示例
AI 助手会根据您的需求自动调用相关工具：
- **时间查询**: "现在几点了？"、"这个月是几月？"
- **笔记分析**: "帮我查看这篇笔记有没有疏漏"、"分析笔记关系"
- **交互式提问**: AI 助手在需要确认用户意图时，会主动提问并提供选项供您选择
- **SubAgent 调用**: "让编程助手帮我优化这段代码"

## 🔧 模型配置说明

### 支持的模型提供商
- **DeepSeek**: 支持直接 API 调用
- **OpenAI**: 支持直接 API 调用和兼容格式
- **Anthropic**: 支持直接 API 调用，不包含 thinking 功能
- **月之暗面 (Moonshot)**: 仅支持代理转发 API

### 月之暗面模型特殊说明
由于浏览器的同源策略限制，月之暗面模型需要通过代理服务器转发请求。

## 📄 许可证

本项目采用 [AGPL-3.0](LICENSE) 许可证。

## 🙏 致谢

- UI 代码部分源于 [@logancyang/obsidian-copilot](https://github.com/logancyang/obsidian-copilot) 项目
  - 感谢开源社区提供的优秀UI组件，让开发者能够专注于核心功能开发

## 📞 支持

如果您遇到问题或有建议，请：
1. 查看 [Issues](https://github.com/your-username/obsidian-agent/issues) 页面
2. 创建新的 Issue 描述问题
3. 提供详细的错误信息和复现步骤

---

**让 AI 助手成为您笔记管理的最佳伙伴！** 🚀
