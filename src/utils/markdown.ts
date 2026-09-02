/**
 * Markdown 轻量纯文本提取（笔记卡片预览用）。
 * 仅做展示层的语法剥离，非完整解析；未识别的字符原样保留。
 */
export function markdownToPlainText(md: string): string {
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
