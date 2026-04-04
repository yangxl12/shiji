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
}

export interface NoteInput {
  title: string;
  content: string;
  category: Category;
  tagColor?: TagColor | null;
}

export type ViewMode = 'list' | 'detail' | 'create' | 'edit';

export type TabType = Category | 'tags';

export interface ToastMessage {
  id: string;
  message: string;
  duration?: number;
}
