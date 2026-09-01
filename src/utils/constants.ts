import type { Category, TagColor } from '../types';

export const DB_NAME = 'shiJiDB';
export const DB_VERSION = 1;
export const STORE_NAME = 'notes';

export const MAX_TITLE_LENGTH = 100;
export const MAX_CONTENT_LENGTH = 50000;

/** 笔记变更后自动推送云端前的防抖时间（毫秒） */
export const SYNC_PUSH_DEBOUNCE = 3000;

export const CATEGORIES: { key: Category; label: string; emptyText: string }[] = [
  { key: 'impromptu', label: '随想', emptyText: '还没有随想，点击右下角记录此刻' },
  { key: 'study', label: '学习', emptyText: '还没有学习笔记，点击右下角开始记录' },
  { key: 'todo', label: '待办', emptyText: '还没有待办事项，点击右下角添加' },
];

/** 标签色值：与 styles/tokens.css 的 --tag-* 令牌保持对齐（仅用于内联样式着色） */
export const TAG_COLORS: { key: TagColor; label: string; value: string }[] = [
  { key: 'red', label: '红', value: '#EF5A4E' },
  { key: 'orange', label: '橙', value: '#F5822E' },
  { key: 'yellow', label: '黄', value: '#F0B429' },
  { key: 'gray', label: '灰', value: '#9A9AA2' },
];
