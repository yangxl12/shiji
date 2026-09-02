import type { ReactNode } from 'react';
import type { Editor, Range } from '@tiptap/core';

/** 斜杠菜单项：icon 为渲染节点，command 在选中后执行（range 已由外部删除） */
export interface SlashMenuItem {
  key: string;
  title: string;
  hint: string;
  icon: ReactNode;
  command: (props: { editor: Editor; range: Range }) => void;
}

/* ── 迷你图标（16px 语义线条，与项目 Material 风格统一） ── */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const iconBulletList = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="4.5" cy="6" r="1.9" />
    <circle cx="4.5" cy="12" r="1.9" />
    <circle cx="4.5" cy="18" r="1.9" />
    <path d="M10 6h10M10 12h10M10 18h10" {...stroke} />
  </svg>
);

const iconOrderedList = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <text x="2" y="8.4" fontSize="7.5" fontWeight="700">1</text>
    <text x="2" y="15.4" fontSize="7.5" fontWeight="700">2</text>
    <text x="2" y="22.4" fontSize="7.5" fontWeight="700">3</text>
    <path d="M9.5 6h11M9.5 13h11M9.5 20h11" {...stroke} />
  </svg>
);

const iconTaskList = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2.5" y="3.5" width="6.5" height="6.5" rx="2" {...stroke} />
    <path d="M4.6 6.8l1.4 1.4 2.4-2.6" {...stroke} strokeWidth={2.2} />
    <rect x="2.5" y="14" width="6.5" height="6.5" rx="2" {...stroke} />
    <path d="M12.5 6.5h9M12.5 17.2h9" {...stroke} />
  </svg>
);

const iconQuote = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
  </svg>
);

const iconCodeBlock = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2 0 4.6-4.6L14.6 7 16 5.6l6 6-6 6z" />
  </svg>
);

const iconTable = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2.5" {...stroke} />
    <path d="M3 9.3h18M3 14.7h18M9.5 4v16" {...stroke} />
  </svg>
);

const iconDivider = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 11.2h7M14 11.2h7" {...stroke} strokeDasharray="0" />
    <path d="M10.5 12l1.5-2.5 1.5 2.5-1.5 2.5z" fill="currentColor" stroke="none" />
  </svg>
);

const iconText = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M5 4h14v3h-5.5v13h-3V7H5z" />
  </svg>
);

const headingGlyph = (label: string) => (
  <span className="slash-menu-glyph" aria-hidden="true">{label}</span>
);

/* ── 菜单项 ── */

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  {
    key: 'h1',
    title: '标题一',
    hint: '大章节标题',
    icon: headingGlyph('H1'),
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    key: 'h2',
    title: '标题二',
    hint: '中章节标题',
    icon: headingGlyph('H2'),
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    key: 'h3',
    title: '标题三',
    hint: '小节标题',
    icon: headingGlyph('H3'),
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    key: 'text',
    title: '正文',
    hint: '普通段落文本',
    icon: iconText,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    key: 'bullet',
    title: '无序列表',
    hint: '项目符号列表',
    icon: iconBulletList,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    key: 'ordered',
    title: '有序列表',
    hint: '编号列表',
    icon: iconOrderedList,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    key: 'task',
    title: '任务清单',
    hint: '可勾选的待办',
    icon: iconTaskList,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    key: 'quote',
    title: '引用',
    hint: '引用块',
    icon: iconQuote,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  },
  {
    key: 'code',
    title: '代码块',
    hint: '多行代码',
    icon: iconCodeBlock,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    key: 'table',
    title: '表格',
    hint: '3×3 表格',
    icon: iconTable,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    key: 'divider',
    title: '分割线',
    hint: '水平分割线',
    icon: iconDivider,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

/** 按查询词过滤菜单项（标题 / key 模糊包含，均忽略大小写） */
export function filterSlashItems(query: string): SlashMenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_MENU_ITEMS;
  return SLASH_MENU_ITEMS.filter(
    (item) => item.title.toLowerCase().includes(q) || item.key.toLowerCase().includes(q),
  );
}
