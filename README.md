# Obsidian Agent

> **UI code partially derived from [@logancyang/obsidian-copilot](https://github.com/logancyang/obsidian-copilot) project**

A powerful Obsidian plugin that integrates AI assistant functionality to help you manage and use your notes more efficiently.

[中文文档](./README.zh-CN.md)

## ✨ Features

### 🤖 AI Chat Assistant
- **Intelligent Dialogue**: Natural language conversations based on configured AI models
- **Context Awareness**: Automatically retrieves current note and contextual note content
- **Multi-model Support**: Supports DeepSeek, OpenAI, Anthropic, Moonshot, and other models

### 🛠️ Tool Ecosystem
- **Built-in Tools**: 
  - Time tools: Get current time information, support time range queries
  - Note reading: Read note content by path or link (supports `[[note name]]` format)
  - Question tool: AI assistant can ask questions to users with multiple choice options for interactive dialogue
  - File editing: Edit file content with diff preview and user confirmation, support creating new files
- **MCP Servers**: Support Model Context Protocol servers to extend custom tools
- **SubAgent**: Create specialized AI assistants to handle specific tasks and domains
- **Tool Management**: Flexibly enable/disable various tools with permission configuration

### ⚙️ Flexible Configuration System
- **Model Configuration**: Configurable API keys, base URLs, temperature, max tokens, and other parameters
- **Settings Persistence**: All configurations are automatically saved locally and persist after restart

## 🎯 Core Features Explained

### SubAgent System
SubAgent allows you to create specialized AI assistants, each with:
- **Dedicated System Prompts**: Define the professional domain and behavior of the sub-agent
- **Independent Model Configuration**: Choose the most suitable AI model for different tasks
- **Tool Permission Management**: Precisely control the tools that sub-agents can use
- **Independent Conversation History**: Each sub-agent maintains independent conversation context

**Use Cases**:
- Create a specialized assistant for web search using [playwright-mcp](https://github.com/microsoft/playwright-mcp) and [bocha-search-mcp](https://github.com/BochaAI/bocha-search-mcp) tools
- Create a specialized assistant for detecting gaps in notes

### MCP Server Integration
Extend plugin functionality through Model Context Protocol:
- **Protocol Support**: Support for stdio, http, and sse protocols
- **Server Management**: Support for adding, editing, and deleting MCP server configurations
- **Tool Discovery**: Automatically discover and register tools provided by MCP servers
- **Permission Control**: Manage tool enablement status for each MCP server individually

## 📖 User Guide

### Starting the AI Assistant
- Click the Obsidian Agent icon in the left sidebar
- Or use the command palette to search for "Obsidian Agent"

### Chatting with AI
1. Enter your question in the chat interface
2. AI will automatically analyze the current note and context
3. Call relevant tools as needed to obtain information
4. Receive intelligent responses and suggestions

### Tool Usage Examples
The AI assistant will automatically call relevant tools based on your needs:
- **Time Queries**: "What time is it now?" "What month is this?"
- **Note Analysis**: "Help me check if this note has any gaps" "Analyze note relationships"
- **File Editing**: "Update the introduction section in this note" "Create a new file with this content"
- **Interactive Questions**: The AI assistant will proactively ask questions with multiple choice options when it needs to clarify user intent
- **SubAgent Calls**: "Let the programming assistant help me optimize this code"

## 🔧 Model Configuration Guide

### Supported Model Providers
- **DeepSeek**: Supports direct API calls
- **OpenAI**: Supports direct API calls and compatible formats
- **Anthropic**: Supports direct API calls, without thinking functionality
- **Moonshot**: Only supports proxy-forwarded API

### Special Notes for Moonshot Models
Due to browser same-origin policy restrictions, Moonshot models require proxy server forwarding.

## 📄 License

This project is licensed under the [AGPL-3.0](LICENSE) license.

## 🙏 Acknowledgments

- UI code partially derived from [@logancyang/obsidian-copilot](https://github.com/logancyang/obsidian-copilot) project
  - Thanks to the open-source community for providing excellent UI components, allowing developers to focus on core functionality development

## 📞 Support

If you encounter issues or have suggestions, please:
1. Check the [Issues](https://github.com/your-username/obsidian-agent/issues) page
2. Create a new Issue to describe the problem
3. Provide detailed error information and reproduction steps

---

**Let AI assistants become your best partner in note management!** 🚀
