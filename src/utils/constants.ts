import type { Category, TagColor } from '../types';

export const DB_NAME = 'shiJiDB';
export const DB_VERSION = 1;
export const STORE_NAME = 'notes';

export const MAX_TITLE_LENGTH = 100;
export const MAX_CONTENT_LENGTH = 50000;

export const CATEGORIES: { key: Category; label: string; emptyText: string }[] = [
  { key: 'impromptu', label: '随想', emptyText: '还没有随想，点击右下角记录此刻' },
  { key: 'study', label: '学习', emptyText: '还没有学习笔记，点击右下角开始记录' },
  { key: 'todo', label: '待办', emptyText: '还没有待办事项，点击右下角添加' },
];

export const TAG_COLORS: { key: TagColor; label: string; value: string }[] = [
  { key: 'red', label: '红', value: '#E54D42' },
  { key: 'orange', label: '橙', value: '#F37B1D' },
  { key: 'yellow', label: '黄', value: '#FBBF24' },
  { key: 'gray', label: '灰', value: '#8C8C8C' },
];

export const COLORS = {
  background: '#FAFAFA',
  card: '#FFFFFF',
  primaryText: '#1A1A1A',
  secondaryText: '#888888',
  tertiaryText: '#BBBBBB',
  divider: '#F0F0F0',
  accent: '#1A1A1A',
  danger: '#E54D42',
  chipBg: '#F5F5F5',
  chipText: '#666666',
  placeholder: '#CCCCCC',
  toastBg: '#1A1A1A',
  toastText: '#FFFFFF',
  modalOverlay: 'rgba(0,0,0,0.4)',
  unselectedTab: '#999999',
  selectedTab: '#1A1A1A',
};

export const ANIMATION_DURATION = {
  pageEnter: 250,
  pageExit: 200,
  fab: 300,
  batchMode: 200,
  toastEnter: 200,
  toastStay: 2000,
  toastExit: 200,
  modal: 200,
  debounce: 500,
  fabDebounce: 300,
  longPress: 300,
};

export const TOUCH_AREA = {
  minSize: 48,
  tabHeight: 56,
  fabSize: 56,
  cardRadius: 12,
  buttonRadius: 8,
  modalRadius: 16,
  fabRadius: 16,
};
