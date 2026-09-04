export type Category = 'impromptu' | 'study' | 'todo';

export type TagColor = 'red' | 'orange' | 'yellow' | 'gray';

export interface Note {
  id: string;
  title: string;
  content: string;
  category: Category;
  tagColor: TagColor | null;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
  /** 软删除时间戳（移入回收站的时刻）；未删除时为 null。用于回收站 15 天到期清理 */
  deletedAt: number | null;
}

export interface NoteInput {
  title: string;
  content: string;
  category: Category;
  tagColor?: TagColor | null;
}

/** AI 模型配置（OpenAI 协议兼容接口） */
export interface AIModelConfig {
  id: string;
  /** 显示名称，如 "DeepSeek" */
  name: string;
  /** 接口基地址，如 https://api.deepseek.com/v1 */
  baseUrl: string;
  apiKey: string;
  /** 模型 ID，如 deepseek-chat */
  model: string;
}

export type ViewMode = 'list' | 'detail' | 'create' | 'edit';

export type TabType = Category | 'tags' | 'settings';

export interface ToastMessage {
  id: string;
  message: string;
  duration?: number;
}
