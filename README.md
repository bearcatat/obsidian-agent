# Obsidian Agent

> **UI代码部分源于 [@logancyang/obsidian-copilot](https://github.com/logancyang/obsidian-copilot) 项目**

一个强大的 Obsidian 插件，集成了 AI 助手功能，帮助您更高效地管理和使用您的笔记。

## ✨ 功能特性

### 🤖 AI 聊天助手
- **智能对话**: 基于配置的 AI 模型进行自然语言对话
- **上下文感知**: 自动获取当前笔记和上下文笔记内容
- **流式响应**: 实时显示 AI 回复，提供更好的交互体验
- **记忆管理**: 智能管理对话历史，保持上下文连贯性

### 🛠️ 内置工具集
- **时间工具**: 获取当前时间信息，支持时间范围查询
- **笔记读取**: 
  - 通过路径读取笔记内容
  - 通过链接读取笔记内容（支持 `[[笔记名称]]` 格式）
- **AI 搜索**: 集成[博查 AI 搜索](https://open.bochaai.com/)，获取网页、多模态参考源等信息

### ⚙️ 灵活的模型配置
- **多模型支持**: 支持 DeepSeek、OpenAI、Anthropic、月之暗面等多种模型
- **自定义配置**: 可配置 API 密钥、基础 URL、温度、最大令牌数等参数
- **模型管理**: 支持添加、编辑、删除多个模型配置
- **代理支持**: 月之暗面模型支持代理转发，解决跨域问题





## 📖 使用指南

### 启动 AI 助手
- 点击左侧边栏的 Obsidian Agent 图标
- 或使用命令面板搜索 "Obsidian Agent"

### 与 AI 对话
1. 在聊天界面输入您的问题
2. AI 会自动分析当前笔记和上下文
3. 根据需要调用相关工具获取信息
4. 获得智能回复和建议

### 工具使用
AI 助手会根据您的需求自动调用相关工具：
- **时间查询**: "现在几点了？"、"这个月是几月？"
- **笔记分析**: "帮我查看这篇笔记有没有疏漏"、"分析笔记关系"
- **信息搜索**: "查找关于最新AI技术的信息"

## 🔧 模型配置说明

### 支持的模型提供商
- **DeepSeek**: 支持直接 API 调用
- **OpenAI**: 支持直接 API 调用和兼容格式
- **Anthropic**: 支持直接 API 调用，包含 thinking 功能
- **月之暗面 (Moonshot)**: 仅支持代理转发 API

### 月之暗面模型特殊说明
由于浏览器的同源策略限制，月之暗面模型需要通过代理服务器转发请求。您需要：

1. **配置代理服务器**：设置 Nginx 或其他代理服务
2. **配置 baseUrl**：在模型设置中指定代理服务器地址
3. **示例配置**：
   ```
   提供商: moonshot
   模型名称: moonshot-v1-8k
   API 密钥: your-api-key
   基础 URL: https://your-proxy-server.com/api/moonshot
   ```

### 代理服务器配置示例
如果您使用 Nginx，可以参考以下配置：
```nginx
location /api/moonshot/ {
    proxy_pass https://api.moonshot.cn/v1/;
    proxy_set_header Host api.moonshot.cn;
    proxy_set_header Authorization $http_authorization;
    
    # CORS 头部
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS' always;
    add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;
}
```



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
