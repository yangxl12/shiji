import type { AIModelConfig } from '../types';

/**
 * OpenAI 协议兼容的 chat/completions 客户端（纯 fetch，无 SDK）。
 */

/** 笔记优化的系统提示词 */
const OPTIMIZE_SYSTEM_PROMPT = [
  '你是一名中文写作润色助手，负责优化用户提供的笔记正文，要求：',
  '1. 更有逻辑、有条理，结构更规整，可合理分段、使用小标题或列表组织内容；',
  '2. 删除啰嗦、重复、无意义的废话，修正错别字与标点错误；',
  '3. 让内容更易读、重点更突出；',
  '4. 语言自然流畅，有一定的文采，但不过度华丽、不堆砌辞藻；',
  '5. 忠实保留原文的信息与语义，不虚构内容、不遗漏要点，保留原文语言。',
  '直接输出优化后的正文，不要任何解释、前言、后记或 markdown 代码围栏。',
].join('\n');

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 拼接接口地址：兼容误粘完整 endpoint 或带尾斜杠的写法 */
function buildEndpoint(baseUrl: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '');
  base = base.replace(/\/chat\/completions$/, '');
  return `${base}/chat/completions`;
}

async function requestChatCompletion(
  config: AIModelConfig,
  messages: ChatMessage[],
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(buildEndpoint(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw new Error('无法连接 AI 服务，请检查网络、API 地址或跨域限制');
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = data?.error?.message ?? '';
    } catch {
      // 响应体解析失败时仅展示状态码
    }
    const hint = response.status === 401 ? '（API Key 可能无效）' : '';
    throw new Error(`AI 服务返回错误 ${response.status}${hint}${detail ? `：${detail}` : ''}`);
  }

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = await response.json();
  } catch {
    throw new Error('AI 服务响应格式异常');
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('AI 未返回有效内容');
  }
  return content;
}

/** 去掉模型可能自作主张包裹的代码围栏 */
function stripCodeFence(text: string): string {
  const t = text.trim();
  if (t.startsWith('```')) {
    const firstLineEnd = t.indexOf('\n');
    if (firstLineEnd !== -1 && t.endsWith('```')) {
      return t.slice(firstLineEnd + 1, -3).trim();
    }
  }
  return t;
}

/** 调用当前模型优化笔记正文，返回优化后的文本 */
export async function optimizeNoteContent(config: AIModelConfig, content: string): Promise<string> {
  const result = await requestChatCompletion(
    config,
    [
      { role: 'system', content: OPTIMIZE_SYSTEM_PROMPT },
      { role: 'user', content },
    ],
    120_000,
  );
  return stripCodeFence(result);
}

/** 测试模型配置连通性（发送一条极短消息） */
export async function testAIConnection(config: AIModelConfig): Promise<void> {
  await requestChatCompletion(config, [{ role: 'user', content: 'hi' }], 45_000);
}
