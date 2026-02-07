# Obsidian Agent

[![版本](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/bearcatat/obsidian-agent/releases)
[![许可证](https://img.shields.io/badge/license-AGPL--3.0-green.svg)](LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-0.15.0+-purple.svg)](https://obsidian.md)

一个强大的 Obsidian 插件，将 AI 助手功能直接集成到您的笔记工作流中。无需离开 Obsidian 即可与 AI 对话、管理工具并提升工作效率。

[English Documentation](./README.md)

## 📑 目录

- [功能特性](#-功能特性)
- [安装](#-安装)
- [快速开始](#-快速开始)
- [使用指南](#-使用指南)
- [配置说明](#-配置说明)
- [许可证](#-许可证)

## ✨ 功能特性

### AI 对话
- **自然对话** - 使用最先进的语言模型与 AI 聊天
- **上下文感知** - 自动将当前笔记和相关笔记纳入对话
- **多模型支持** - 支持 DeepSeek、OpenAI、Anthropic、月之暗面等
- **图片支持** - 从剪贴板粘贴图片到对话中

### 🛠️ 可扩展工具
- **内置工具** - 时间、笔记读取、文件编辑、网页获取、本地搜索
- **MCP 服务器** - 通过 Model Context Protocol 扩展功能
- **子代理** - 创建专门的 AI 助手处理特定任务
- **工具管理** - 精细控制工具启用和权限

### ⚙️ 灵活配置
- 可自定义 API 端点、温度、最大令牌数
- 设置跨会话持久保存
- 支持每个模型独立配置

## 📦 安装

### 手动安装
1. 从 [GitHub Releases](https://github.com/bearcatat/obsidian-agent/releases) 下载最新版本
2. 解压到 `.obsidian/plugins/obsidian-agent/`
3. 重新加载 Obsidian 并启用插件

## 🚀 快速开始

1. **打开插件** - 点击左侧边栏的图标或使用命令面板
2. **配置模型** - 在设置 → Obsidian Agent → 模型中添加 API 密钥
3. **开始对话** - 输入问题并按回车
4. **添加上下文** - 拖拽笔记或粘贴图片以纳入对话

## 📖 使用指南

### 基础对话
直接输入问题并按回车。AI 会自动分析当前笔记并智能回复。

### 使用上下文
- **笔记** - 拖拽笔记或点击"添加上下文"按钮
- **图片** - 粘贴图片（Ctrl+V）添加视觉上下文
- **当前笔记** - 当前打开的笔记自动纳入上下文

### 工具使用示例
自然地提问，AI 会自动使用合适的工具：
- "现在几点了？"
- "查找所有提到'项目计划'的笔记"
- "帮我改进这篇笔记的结构"
- "在我的日记中搜索待办事项"

### 子代理
为特定工作流创建专门的助手：
1. 前往设置 → Obsidian Agent → 子代理
2. 点击"添加子代理"
3. 定义系统提示词并选择工具

## 🔧 配置说明

### 支持的模型

| 提供商 | 直接 API | 说明 |
|--------|---------|------|
| DeepSeek | ✅ | 完整支持 |
| OpenAI | ✅ | 包括兼容 API |
| Anthropic | ✅ | 不包含思考模式 |
| 月之暗面 | ⚠️ | 需要代理（CORS）|

### MCP 服务器
通过外部工具扩展功能：
1. 设置 → Obsidian Agent → MCP 服务器
2. 添加服务器配置（stdio/http/sse）
3. 启用每个服务器的工具

## 📄 许可证

本项目采用 [AGPL-3.0](LICENSE) 许可证。

## 🙏 致谢

- [obsidian-copilot](https://github.com/logancyang/obsidian-copilot) by @logancyang
- [opencode](https://github.com/anomalyco/opencode)

---

**为 Obsidian 社区用 ❤️ 制作**
