import * as vscode from 'vscode';
import { queryLLMStream, LLMConfig } from '../llm/client';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _abortController?: AbortController;
  private _log: vscode.OutputChannel;

  constructor(private context: vscode.ExtensionContext) {
    this._log = vscode.window.createOutputChannel('Markdown 速记');
    context.subscriptions.push(this._log);
    this._log.appendLine('[init] SidebarProvider created');
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._log.appendLine('[resolve] Webview view resolved');

    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage((msg) => {
      this._log.appendLine(`[webview] Received message: ${msg.type}`);
      switch (msg.type) {
        case 'insert':
        case 'insertAll':
        case 'insertSelection':
          vscode.commands.executeCommand('markdownSuji.insertText', msg.text);
          break;
      }
    });

    webviewView.onDidDispose(() => {
      this._log.appendLine('[dispose] Webview disposed');
      this._abortController?.abort();
    });
  }

  async query(text: string) {
    this._log.appendLine(`[query] Called with: "${text}"`);
    this._log.appendLine(`[query] this._view defined: ${!!this._view}`);

    if (!this._view) {
      this._log.appendLine('[query] No view available, returning');
      return;
    }

    this._abortController?.abort();
    this._abortController = new AbortController();

    const config = this._getConfig();
    this._log.appendLine(`[config] endpoint: ${config.endpoint}`);
    this._log.appendLine(`[config] model: ${config.model}`);
    this._log.appendLine(`[config] apiKey set: ${!!config.apiKey}`);

    if (!config.apiKey) {
      this._log.appendLine('[query] No API key configured');
      this._view.webview.postMessage({
        type: 'error',
        message: '请先在设置中配置 API Key（⚙ → 设置 → 搜索 "Markdown 速记"）',
      });
      return;
    }

    this._view.webview.postMessage({ type: 'start', query: text });
    this._log.appendLine('[query] Sent start to webview, awaiting LLM stream...');

    try {
      let fullContent = '';
      let chunkCount = 0;
      for await (const chunk of queryLLMStream(
        config,
        text,
        this._abortController.signal
      )) {
        chunkCount++;
        fullContent += chunk;
        if (chunkCount <= 3) {
          this._log.appendLine(
            `[query] Chunk #${chunkCount}: "${chunk.slice(0, 80)}..."`
          );
        }
        this._view.webview.postMessage({
          type: 'chunk',
          content: fullContent,
        });
      }

      this._log.appendLine(
        `[query] Stream done: ${chunkCount} chunks, ${fullContent.length} chars`
      );

      this._view.webview.postMessage({
        type: 'done',
        content: fullContent,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this._log.appendLine('[query] Aborted');
        return;
      }
      const message =
        err instanceof Error ? err.message : '未知错误';
      this._log.appendLine(`[query] ERROR: ${message}`);
      if (err instanceof Error && err.stack) {
        this._log.appendLine(`[query] Stack: ${err.stack.slice(0, 500)}`);
      }

      this._view.webview.postMessage({ type: 'error', message });
      vscode.window.showErrorMessage(`Markdown 速记: ${message}`);
    }
  }

  private _getConfig(): LLMConfig {
    const cfg = vscode.workspace.getConfiguration('markdownSuji');
    return {
      endpoint: cfg.get<string>('endpoint', 'https://api.openai.com/v1'),
      apiKey: cfg.get<string>('apiKey', ''),
      model: cfg.get<string>('model', 'gpt-4o-mini'),
      systemPrompt: cfg.get<string>(
        'systemPrompt',
        '你是一个知识助手。用户会输入一个词或短语，请给出清晰的定义和解释。使用 Markdown 格式回复，包含标题、段落和要点。'
      ),
    };
  }

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-editor-foreground);
  padding: 12px;
  overflow-x: hidden;
}
.header { margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--vscode-widget-border); }
.query-label { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
.query-term { font-weight: 600; font-size: 14px; word-break: break-word; }
.toolbar { display: flex; gap: 4px; margin: 8px 0; flex-wrap: wrap; }
.toolbar button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none; border-radius: 3px;
  padding: 3px 10px; font-size: 12px; cursor: pointer;
}
.toolbar button:hover { background: var(--vscode-button-hoverBackground); }
.toolbar button:disabled { opacity: 0.5; cursor: default; }
.toolbar button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.content { line-height: 1.7; }
.content h1, .content h2, .content h3 { margin: 12px 0 6px; font-weight: 600; }
.content h1 { font-size: 1.2em; }
.content h2 { font-size: 1.1em; }
.content h3 { font-size: 1.05em; }
.content p { margin: 6px 0; }
.content ul, .content ol { padding-left: 20px; margin: 6px 0; }
.content li { margin: 2px 0; }
.content code {
  background: var(--vscode-textCodeBlock-background);
  padding: 1px 5px; border-radius: 3px;
  font-family: var(--vscode-editor-font-family);
  font-size: 0.9em;
}
.content pre {
  background: var(--vscode-textCodeBlock-background);
  padding: 8px; border-radius: 4px;
  overflow-x: auto; margin: 8px 0;
}
.content pre code { background: none; padding: 0; }
.content strong { font-weight: 600; }
.content a { color: var(--vscode-textLink-foreground); }
.block {
  position: relative;
  padding: 3px 0;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.1s;
}
.block:hover { background: var(--vscode-list-hoverBackground); }
.block .insert-btn {
  display: none;
  position: absolute;
  right: 4px; top: 2px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none; border-radius: 3px;
  padding: 1px 7px;
  font-size: 10px;
  cursor: pointer;
  z-index: 10;
  opacity: 0.9;
}
.block:hover .insert-btn { display: block; }
.block .insert-btn:hover { opacity: 1; }
.loading {
  display: flex; align-items: center; gap: 8px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px; padding: 16px 0;
}
.spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--vscode-descriptionForeground);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.error {
  color: var(--vscode-errorForeground);
  padding: 12px 0; font-size: 13px;
}
.empty {
  color: var(--vscode-descriptionForeground);
  padding: 24px 0; text-align: center;
  font-size: 13px; line-height: 1.6;
}
</style>
</head>
<body>
  <div class="header">
    <div class="query-label">当前查询</div>
    <div class="query-term" id="queryTerm">—</div>
  </div>

  <div class="toolbar" id="toolbar" style="display:none">
    <button id="btnInsertAll">插入全部</button>
    <button class="secondary" id="btnInsertSel" disabled>插入选中</button>
    <button class="secondary" id="btnNewQuery">新建查询</button>
  </div>

  <div class="content" id="content"></div>
  <div id="status"></div>

<script>
(function() {
  const vscode = acquireVsCodeApi();
  const content = document.getElementById('content');
  const queryTerm = document.getElementById('queryTerm');
  const toolbar = document.getElementById('toolbar');
  const status = document.getElementById('status');

  let fullContent = '';
  let blockTexts = [];

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inlineMd(text) {
    return text
      .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
      .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
      .replace(/\\[(.+?)\\]\\((.+?)\\)/g, '<a href="$2">$1</a>');
  }

  function renderMarkdown(md) {
    if (!md) return '';
    const lines = md.split('\\n');
    let html = '';
    blockTexts = [];
    let inCode = false;
    let codeText = '';

    function pushBlock(text, inner) {
      const idx = blockTexts.length;
      blockTexts.push(text);
      html += '<div class="block" data-idx="' + idx + '">'
        + inner
        + '<button class="insert-btn" data-idx="' + idx + '">插入</button>'
        + '</div>';
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (inCode) {
        if (line.startsWith('\`\`\`')) {
          pushBlock(codeText.trimEnd(),
            '<pre><code>' + escapeHtml(codeText.trimEnd()) + '</code></pre>');
          inCode = false;
          codeText = '';
          continue;
        }
        codeText += line + '\\n';
        continue;
      }

      if (line.startsWith('\`\`\`')) {
        inCode = true;
        codeText = '';
        continue;
      }

      if (line.startsWith('### ')) {
        pushBlock(line.slice(4), '<h3>' + inlineMd(line.slice(4)) + '</h3>');
      } else if (line.startsWith('## ')) {
        pushBlock(line.slice(3), '<h2>' + inlineMd(line.slice(3)) + '</h2>');
      } else if (line.startsWith('# ')) {
        pushBlock(line.slice(2), '<h1>' + inlineMd(line.slice(2)) + '</h1>');
      } else if (line.startsWith('- ')) {
        const text = line.slice(2);
        pushBlock(text, '<li>' + inlineMd(text) + '</li>');
      } else if (/^\\d+\\.\\s/.test(line)) {
        const text = line.replace(/^\\d+\\.\\s/, '');
        pushBlock(text, '<li>' + inlineMd(text) + '</li>');
      } else if (line.trim() === '') {
        html += '<div style="height:6px"></div>';
      } else {
        pushBlock(line, '<p>' + inlineMd(line) + '</p>');
      }
    }

    if (inCode && codeText) {
      pushBlock(codeText.trimEnd(),
        '<pre><code>' + escapeHtml(codeText.trimEnd()) + '</code></pre>');
    }

    return html;
  }

  function insertBlockText(idx) {
    const text = blockTexts[idx];
    if (text) vscode.postMessage({ type: 'insert', text });
  }

  document.getElementById('btnInsertAll').onclick = function() {
    if (fullContent) vscode.postMessage({ type: 'insertAll', text: fullContent });
  };

  document.getElementById('btnInsertSel').onclick = function() {
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      vscode.postMessage({ type: 'insertSelection', text: sel.toString().trim() });
    }
  };

  document.getElementById('btnNewQuery').onclick = function() {
    content.innerHTML = '';
    fullContent = '';
    queryTerm.textContent = '—';
    toolbar.style.display = 'none';
    status.innerHTML = '<div class="empty">选中 Markdown 中的关键词<br>右键 → 查询解释</div>';
  };

  content.addEventListener('click', function(e) {
    const btn = e.target.closest('.insert-btn');
    if (btn) {
      const idx = parseInt(btn.getAttribute('data-idx'));
      insertBlockText(idx);
      return;
    }
    const block = e.target.closest('.block');
    if (block) {
      const idx = parseInt(block.getAttribute('data-idx'));
      insertBlockText(idx);
    }
  });

  document.addEventListener('mouseup', function() {
    const sel = window.getSelection();
    document.getElementById('btnInsertSel').disabled =
      !(sel && sel.toString().trim());
  });

  window.addEventListener('message', function(event) {
    const msg = event.data;
    switch (msg.type) {
      case 'start':
        queryTerm.textContent = msg.query;
        toolbar.style.display = 'flex';
        content.innerHTML = '';
        fullContent = '';
        status.innerHTML = '<div class="loading"><div class="spinner"></div><span>AI 思考中...</span></div>';
        break;

      case 'chunk':
        fullContent = msg.content;
        try {
          content.innerHTML = renderMarkdown(msg.content);
        } catch(e) {
          content.innerHTML = '<div class="error">渲染错误: ' + e.message + '</div>';
        }
        status.innerHTML = '<div class="loading"><div class="spinner"></div><span>生成中... (' + msg.content.length + ' 字)</span></div>';
        break;

      case 'done':
        try {
          content.innerHTML = renderMarkdown(msg.content);
        } catch(e) {
          content.innerHTML = '<div class="error">渲染错误: ' + e.message + '</div>';
        }
        status.innerHTML = '<div style="font-size:11px;color:var(--vscode-descriptionForeground);padding:8px 0">✓ 完成 (' + msg.content.length + ' 字)</div>';
        break;

      case 'error':
        status.innerHTML = '<div class="error">' + escapeHtml(msg.message) + '</div>';
        break;
    }
  });

  status.innerHTML = '<div class="empty">选中 Markdown 中的关键词<br>右键 → 查询解释</div>';
})();
</script>
</body>
</html>`;
  }
}
