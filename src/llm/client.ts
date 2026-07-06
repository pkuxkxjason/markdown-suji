import * as https from 'https';
import * as http from 'http';

export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
}

export function queryLLMStream(
  config: LLMConfig,
  query: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  return streamGenerator(config, query, signal);
}

async function* streamGenerator(
  config: LLMConfig,
  query: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const url = new URL(`${config.endpoint.replace(/\/+$/, '')}/chat/completions`);
  const isHttps = url.protocol === 'https:';
  const mod = isHttps ? https : http;

  const postBody = JSON.stringify({
    model: config.model,
    messages: [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: `请解释以下关键词：\n\n${query}` },
    ],
    stream: true,
  });

  const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Length': Buffer.byteLength(postBody),
      },
      timeout: 30000,
    };

    const req = mod.request(options, resolve);
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('请求超时（30秒）'));
    });

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          req.destroy(new Error('AbortError'));
        },
        { once: true }
      );
    }

    req.write(postBody);
    req.end();
  });

  if (res.statusCode !== 200) {
    let errBody = '';
    for await (const chunk of res) {
      errBody += chunk.toString();
      if (errBody.length > 300) break;
    }
    throw new Error(`API 错误 (${res.statusCode}): ${errBody.slice(0, 300)}`);
  }

  let buffer = '';
  for await (const chunk of res) {
    const text = chunk.toString();
    buffer += text;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}
