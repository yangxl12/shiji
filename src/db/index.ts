import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Note, NoteInput, TagColor } from '../types';
import { DB_NAME, DB_VERSION, STORE_NAME, MAX_TITLE_LENGTH, MAX_CONTENT_LENGTH, TRASH_RETENTION_DAYS } from '../utils/constants';

interface ShiJiDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: {
      'by-category': string;
      'by-tagColor': string;
      'by-createdAt': number;
      'by-updatedAt': number;
    };
  };
}

let db: IDBPDatabase<ShiJiDB> | null = null;

// ===== 笔记排序：标记颜色优先级（红 > 橙 > 黄 > 灰 > 无标记），同优先级按创建时间降序 =====

const TAG_COLOR_PRIORITY: Record<TagColor, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
  gray: 3,
};

const UNTAGGED_PRIORITY = 4;

function compareNotes(a: Note, b: Note): number {
  const priorityA = a.tagColor ? TAG_COLOR_PRIORITY[a.tagColor] : UNTAGGED_PRIORITY;
  const priorityB = b.tagColor ? TAG_COLOR_PRIORITY[b.tagColor] : UNTAGGED_PRIORITY;
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }
  return b.createdAt - a.createdAt;
}

// ===== 数据变更通知（供同步模块监听本地写入，触发防抖推送） =====

type DataChangeListener = () => void;
let dataChangeListener: DataChangeListener | null = null;

export function setDataChangeListener(listener: DataChangeListener | null): void {
  dataChangeListener = listener;
}

function notifyDataChange(): void {
  dataChangeListener?.();
}

export async function initDB(): Promise<IDBPDatabase<ShiJiDB>> {
  if (db) return db;

  try {
    db = await openDB<ShiJiDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by-category', 'category', { unique: false });
          store.createIndex('by-tagColor', 'tagColor', { unique: false });
          store.createIndex('by-createdAt', 'createdAt', { unique: false });
          store.createIndex('by-updatedAt', 'updatedAt', { unique: false });
        }
      },
    });
    return db;
  } catch (error) {
    console.error('IndexedDB 初始化失败:', error);
    throw new Error('存储初始化失败，请检查浏览器设置');
  }
}

export function getDB(): IDBPDatabase<ShiJiDB> {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDB()');
  }
  return db;
}

function truncateText(text: string, maxLength: number): { text: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxLength), truncated: true };
}

function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

export async function createNote(input: NoteInput): Promise<{ note: Note; warnings: string[] }> {
  const db = getDB();
  const warnings: string[] = [];

  let title = input.title.trim();
  let content = input.content;

  const titleResult = truncateText(title, MAX_TITLE_LENGTH);
  if (titleResult.truncated) {
    warnings.push('标题过长，已自动截断');
    title = titleResult.text;
  }

  const contentResult = truncateText(content, MAX_CONTENT_LENGTH);
  if (contentResult.truncated) {
    warnings.push('内容过长，已自动截断');
    content = contentResult.text;
  }

  if (isBlank(title) && isBlank(content)) {
    throw new Error('请输入标题或内容');
  }

  const now = Date.now();
  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
  };
  const note: Note = {
    id: generateId(),
    title,
    content,
    category: input.category,
    tagColor: input.tagColor ?? null,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
    deletedAt: null,
  };

  try {
    await db.add(STORE_NAME, note);
    notifyDataChange();
    return { note, warnings };
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('存储空间不足');
    }
    throw error;
  }
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'tagColor'>>
): Promise<{ note: Note; warnings: string[] }> {
  const db = getDB();
  const warnings: string[] = [];

  const existingNote = await db.get(STORE_NAME, id);
  if (!existingNote) {
    throw new Error('笔记不存在');
  }

  let title = updates.title !== undefined ? updates.title.trim() : existingNote.title;
  let content = updates.content !== undefined ? updates.content : existingNote.content;

  if (isBlank(title) && isBlank(content)) {
    throw new Error('请输入标题或内容');
  }

  const titleResult = truncateText(title, MAX_TITLE_LENGTH);
  if (titleResult.truncated) {
    warnings.push('标题过长，已自动截断');
    title = titleResult.text;
  }

  const contentResult = truncateText(content, MAX_CONTENT_LENGTH);
  if (contentResult.truncated) {
    warnings.push('内容过长，已自动截断');
    content = contentResult.text;
  }

  const updatedNote: Note = {
    ...existingNote,
    title,
    content,
    tagColor: updates.tagColor !== undefined ? updates.tagColor : existingNote.tagColor,
    updatedAt: Date.now(),
  };

  try {
    await db.put(STORE_NAME, updatedNote);
    notifyDataChange();
    return { note: updatedNote, warnings };
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('存储空间不足');
    }
    throw error;
  }
}

export async function softDeleteNote(id: string): Promise<void> {
  const db = getDB();
  const note = await db.get(STORE_NAME, id);
  if (!note) {
    throw new Error('笔记不存在');
  }

  note.isDeleted = true;
  note.deletedAt = Date.now();
  note.updatedAt = Date.now();
  await db.put(STORE_NAME, note);
  notifyDataChange();
}

export async function batchSoftDeleteNote(ids: string[]): Promise<void> {
  const db = getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const now = Date.now();
  for (const id of ids) {
    const note = await store.get(id);
    if (note) {
      note.isDeleted = true;
      note.deletedAt = now;
      note.updatedAt = now;
      await store.put(note);
    }
  }

  await tx.done;
  notifyDataChange();
}

export async function getNoteById(id: string): Promise<Note | undefined> {
  const db = getDB();
  const note = await db.get(STORE_NAME, id);
  return note?.isDeleted ? undefined : note;
}

/**
 * 未删除的全部笔记（按标记色 + 创建时间排序）。
 * 列表页 / 标签页 / 搜索共用这一次读取，再在内存里分组，避免切页重复扫库。
 */
export async function getAllNotes(): Promise<Note[]> {
  const db = getDB();
  const allNotes = await db.getAll(STORE_NAME);
  return allNotes
    .filter((note) => !note.isDeleted)
    .sort(compareNotes);
}

export async function updateNoteTagColor(id: string, tagColor: TagColor | null): Promise<Note> {
  const db = getDB();
  const note = await db.get(STORE_NAME, id);
  if (!note) {
    throw new Error('笔记不存在');
  }

  note.tagColor = tagColor;
  note.updatedAt = Date.now();
  await db.put(STORE_NAME, note);
  notifyDataChange();
  return note;
}

// ===== 回收站 =====

/** 回收站笔记的删除时间：兼容旧数据（未记录 deletedAt 时回退 updatedAt） */
function deletedAtOf(note: Note): number {
  return note.deletedAt ?? note.updatedAt;
}

/** 读取回收站全部笔记（isDeleted），按删除时间倒序 */
export async function getDeletedNotes(): Promise<Note[]> {
  const db = getDB();
  const allNotes = await db.getAll(STORE_NAME);
  return allNotes
    .filter((note) => note.isDeleted)
    .sort((a, b) => deletedAtOf(b) - deletedAtOf(a));
}

/** 从回收站恢复单条笔记 */
export async function restoreNote(id: string): Promise<void> {
  const db = getDB();
  const note = await db.get(STORE_NAME, id);
  if (!note) {
    throw new Error('笔记不存在');
  }

  note.isDeleted = false;
  note.deletedAt = null;
  note.updatedAt = Date.now();
  await db.put(STORE_NAME, note);
  notifyDataChange();
}

/** 从回收站批量恢复 */
export async function batchRestoreNote(ids: string[]): Promise<void> {
  const db = getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const now = Date.now();
  for (const id of ids) {
    const note = await store.get(id);
    if (note) {
      note.isDeleted = false;
      note.deletedAt = null;
      note.updatedAt = now;
      await store.put(note);
    }
  }

  await tx.done;
  notifyDataChange();
}

/** 彻底删除单条笔记（物理删除，不可恢复） */
export async function hardDeleteNote(id: string): Promise<void> {
  const db = getDB();
  await db.delete(STORE_NAME, id);
  notifyDataChange();
}

/** 批量彻底删除（物理删除，不可恢复） */
export async function batchHardDeleteNote(ids: string[]): Promise<void> {
  const db = getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const id of ids) {
    await store.delete(id);
  }
  await tx.done;
  notifyDataChange();
}

/**
 * 清理回收站中超过保留期的笔记（物理删除）。
 * 返回被彻底删除的条数；调用时机：应用启动后、打开回收站时。
 */
export async function purgeExpiredNotes(): Promise<number> {
  const db = getDB();
  const allNotes = await db.getAll(STORE_NAME);
  const threshold = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const expiredIds = allNotes
    .filter((note) => note.isDeleted && deletedAtOf(note) < threshold)
    .map((note) => note.id);

  if (expiredIds.length === 0) return 0;

  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const id of expiredIds) {
    await store.delete(id);
  }
  await tx.done;
  notifyDataChange();
  return expiredIds.length;
}
