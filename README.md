# Obsidian Agent

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/bearcatat/obsidian-agent/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-green.svg)](LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-0.15.0+-purple.svg)](https://obsidian.md)

A powerful Obsidian plugin that brings AI assistant capabilities directly into your note-taking workflow. Chat with AI, manage tools, and enhance your productivity without leaving Obsidian.

[中文文档](./README.zh-CN.md)

## 📑 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage Guide](#-usage-guide)
- [Configuration](#-configuration)
- [License](#-license)

## ✨ Features

### AI Chat
- **Natural Conversations** - Chat with AI using state-of-the-art language models
- **Context Aware** - Automatically includes current note and related notes in conversations
- **Multi-Model Support** - DeepSeek, OpenAI, Anthropic, Moonshot, Google Gemini, and more
- **Image Support** - Paste images from clipboard into conversations

### 🛠️ Extensible Tools
- **Built-in Tools** - Time, note reading, file editing, web fetching, local search
- **MCP Servers** - Extend with Model Context Protocol servers
- **SubAgents** - Create specialized AI assistants for specific tasks
- **Tool Management** - Enable/disable tools with granular permissions

### ⚙️ Flexible Configuration
- Customizable API endpoints, temperature, max tokens
- Persistent settings across sessions
- Per-model configuration support

## 📦 Installation

### Install using BRAT (Recommended)
1. Install and enable the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from the Obsidian Community Plugins.
2. Open BRAT settings, click "Add Beta plugin".
3. Enter the repository address: `https://github.com/bearcatat/obsidian-agent`
4. Click "Add Plugin".
5. Once installed, go to Obsidian Settings -> Community Plugins and enable "Obsidian Agent".

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/bearcatat/obsidian-agent/releases)
2. Extract to `.obsidian/plugins/obsidian-agent/`
3. Reload Obsidian and enable the plugin

## 🚀 Quick Start

1. **Open the Plugin** - Click the icon in the left sidebar or use the command palette
2. **Configure a Model** - Add your API key in Settings → Obsidian Agent → Models
3. **Start Chatting** - Type your question and press Enter
4. **Add Context** - Drag notes or paste images to include them in the conversation

## 📖 Usage Guide

### Basic Chat
Simply type your question and press Enter. The AI will automatically analyze your current note and respond intelligently.

### Using Context
- **Notes** - Drag and drop notes or click "Add Context" to include them
- **Images** - Paste images (Ctrl+V) to add visual context
- **Active Note** - The currently open note is automatically included

### Tool Examples
Ask naturally and the AI will use appropriate tools:
- "What's the current time?"
- "Find all notes mentioning 'project plan'"
- "Help me improve this note's structure"
- "Search for TODO items in my journal"

### SubAgents
Create specialized assistants for specific workflows:
1. Go to Settings → Obsidian Agent → SubAgents
2. Click "Add SubAgent"
3. Define the system prompt and select tools

## 🔧 Configuration

### Supported Models

| Provider | Direct API | Notes |
|----------|-----------|-------|
| DeepSeek | ✅ | Full support |
| OpenAI | ✅ | Including compatible APIs |
| Anthropic | ✅ | No thinking mode |
| Moonshot | ⚠️ | Enable "Use CORS Proxy" in model settings |
| Google Gemini | ✅ | Full support |

### MCP Servers
Extend functionality with external tools:
1. Settings → Obsidian Agent → MCP Servers
2. Add server configuration (stdio/http/sse)
3. Enable desired tools from each server

## 📄 License

This project is licensed under the [AGPL-3.0](LICENSE) license.

## 🙏 Acknowledgments

- [obsidian-copilot](https://github.com/logancyang/obsidian-copilot) by @logancyang
- [opencode](https://github.com/anomalyco/opencode)

---

**Made with ❤️ for the Obsidian community**
