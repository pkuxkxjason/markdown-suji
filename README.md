# Markdown 速记

VS Code 扩展 - 选中关键词，AI 查询解释并一键插入笔记。

## 功能

- **选中查询**：在 Markdown 文件中选中关键词，右键或快捷键触发 AI 查询
- **侧边栏展示**：流式输出，实时渲染 Markdown 格式的解释
- **一键插入**：
  - 点击任意段落/标题/代码块，直接插入到光标位置
  - 选中侧边栏中的部分文本 → "插入选中"
  - 点击 "插入全部" 将完整解释插入笔记
- **兼容 OpenAI API**：可接入 ChatGPT、DeepSeek、通义千问等任意 OpenAI 兼容接口

## 使用

1. 选中 Markdown 中的关键词
2. 右键 → **Markdown 速记：查询解释**（或快捷键 `⌘+Shift+Q`）
3. 侧边栏展示 AI 返回的解释
4. 点击段落插入笔记，或选中部分文本插入

## 配置

在 VS Code 设置中搜索 `Markdown 速记`：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `markdownSuji.endpoint` | `https://api.openai.com/v1` | API 地址 |
| `markdownSuji.apiKey` | `""` | API Key |
| `markdownSuji.model` | `gpt-4o-mini` | 模型名称 |
| `markdownSuji.systemPrompt` | 预置提示词 | 自定义提示词 |

## 开发

```bash
git clone git@github.com:pkuxkxjason/markdown-suji.git
cd markdown-suji
npm install
npm run compile
```

按 `F5` 启动 Extension Development Host 进行调试。
