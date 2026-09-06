import { Marked } from 'marked';

/**
 * Markdown 轻量纯文本提取（笔记卡片预览用）。
 * 仅做展示层的语法剥离，非完整解析；未识别的字符原样保留。
 */
function toPlainText(md: string): string {
  let text = md;

  // 代码块：保留内容，去掉围栏与语言标记
  text = text.replace(/```[^\n]*\n([\s\S]*?)```/g, '$1');
  // 行内代码
  text = text.replace(/`([^`\n]+)`/g, '$1');
  // 图片 → 替换为 alt 文本
  text = text.replace(/!\[([^\]]*)\]\([^)\n]*\)/g, '$1');
  // 链接 → 保留链接文字
  text = text.replace(/\[([^\]]*)\]\([^)\n]*\)/g, '$1');
  // 加粗 / 斜体 / 删除线 / 高亮
  text = text.replace(/(\*\*|__|~~|==)(.+?)\1/g, '$2');
  text = text.replace(/(\*|_)([^*_\n]+)\1/g, '$2');
  // 标题记号
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  // 引用
  text = text.replace(/^\s{0,3}>\s?/gm, '');
  // 任务清单与列表标记
  text = text.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+[.)]\s+/gm, '');
  // 表格：丢弃分隔行，其余行去竖线
  text = text.replace(/^\s*\|?[-:| ]+\|?\s*$/gm, '');
  text = text.replace(/^\s*\|/gm, '').replace(/\|\s*$/gm, '');
  text = text.replace(/\s*\|\s*/g, ' ');
  // 分割线 → 长破折
  text = text.replace(/^\s*([-*_]\s*){3,}$/gm, '—');
  // 压缩多余空行
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

// ===== 结果缓存 =====
// 卡片反复展开/收起、搜索重建索引、列表重渲染都会重复解析同一份正文。
// 缓存后重复解析为零成本，展开动画不再被 marked 解析阻塞。

const PLAIN_CACHE_LIMIT = 300;
const HTML_CACHE_LIMIT = 60;

const plainCache = new Map<string, string>();
const htmlCache = new Map<string, string>();

function readCache(cache: Map<string, string>, key: string): string | undefined {
  const hit = cache.get(key);
  if (hit === undefined) return undefined;
  // 命中后移到队尾，维持 LRU 顺序
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function writeCache(
  cache: Map<string, string>,
  limit: number,
  key: string,
  value: string,
): void {
  cache.set(key, value);
  if (cache.size > limit) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/** Markdown → 预览纯文本（带缓存） */
export function markdownToPlainText(md: string): string {
  const hit = readCache(plainCache, md);
  if (hit !== undefined) return hit;
  const text = toPlainText(md);
  writeCache(plainCache, PLAIN_CACHE_LIMIT, md, text);
  return text;
}

/** 与编辑器 Markdown.configure({ markedOptions }) 一致，保证预览与编辑所见即所得 */
const mdRenderer = new Marked({ gfm: true, breaks: true });

/** 整体移除的危险标签 */
const DANGEROUS_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base']);
/** 可承载 URL 的属性（拦截 javascript: 协议） */
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'poster', 'background']);

// 复用同一个游离节点做清洗宿主：比每次 new DOMParser().parseFromString 快一个量级
let sanitizeHost: HTMLDivElement | null = null;

/** 轻量 sanitize：marked 默认放行内联 HTML，渲染进 DOM 前剔除脚本/事件属性/危险协议 */
function sanitize(html: string): string {
  sanitizeHost ??= document.createElement('div');
  sanitizeHost.innerHTML = html;
  sanitizeHost.querySelectorAll('*').forEach((el) => {
    if (DANGEROUS_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      return;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const isUrlAttr = URL_ATTRS.has(name) && attr.value.trim().toLowerCase().startsWith('javascript:');
      if (name.startsWith('on') || isUrlAttr) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return sanitizeHost.innerHTML;
}

/** Markdown → 受信 HTML（卡片展开预览用，带缓存） */
export function renderMarkdownHtml(md: string): string {
  const hit = readCache(htmlCache, md);
  if (hit !== undefined) return hit;
  const html = sanitize(mdRenderer.parse(md, { async: false }));
  writeCache(htmlCache, HTML_CACHE_LIMIT, md, html);
  return html;
}

// ===== 空闲预热 =====
// 首屏渲染后趁空闲把可见卡片的 HTML 渲染好，用户首次点击展开时直接命中缓存，
// 不会有「点一下先卡住再展开」的体感。

// Set 而非数组：多张卡片正文相同时自动去重，长列表不会把队列堆成 O(n²)
const warmQueue = new Set<string>();
let warmHandle: number | null = null;

function runWarm(deadline?: IdleDeadline): void {
  warmHandle = null;
  for (const md of warmQueue) {
    // 剩余时间不足就把控制权交还浏览器，下一轮空闲继续
    if (deadline && deadline.timeRemaining() < 4) break;
    warmQueue.delete(md);
    if (!htmlCache.has(md)) renderMarkdownHtml(md);
  }
  if (warmQueue.size > 0) scheduleWarm();
}

function scheduleWarm(): void {
  if (warmHandle !== null) return;
  if (typeof window.requestIdleCallback === 'function') {
    warmHandle = window.requestIdleCallback(runWarm, { timeout: 2000 });
  } else {
    warmHandle = window.setTimeout(() => runWarm(), 200);
  }
}

/** 预约在浏览器空闲时预渲染该正文的 HTML（重复预约同一内容会自动去重） */
export function prewarmMarkdownHtml(md: string): void {
  if (!md || htmlCache.has(md)) return;
  warmQueue.add(md);
  scheduleWarm();
}
