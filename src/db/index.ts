import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Note, NoteInput, Category, TagColor } from '../types';
import { DB_NAME, DB_VERSION, STORE_NAME, MAX_TITLE_LENGTH, MAX_CONTENT_LENGTH } from '../utils/constants';

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
  };

  try {
    await db.add(STORE_NAME, note);
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
  note.updatedAt = Date.now();
  await db.put(STORE_NAME, note);
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
      note.updatedAt = now;
      await store.put(note);
    }
  }

  await tx.done;
}

export async function getNoteById(id: string): Promise<Note | undefined> {
  const db = getDB();
  const note = await db.get(STORE_NAME, id);
  return note?.isDeleted ? undefined : note;
}

export async function getNotesByCategory(category: Category): Promise<Note[]> {
  const db = getDB();
  const index = db.transaction(STORE_NAME).store.index('by-category');
  const allNotes = await index.getAll(category);
  return allNotes
    .filter((note) => !note.isDeleted)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getNotesByTagColor(tagColor: TagColor): Promise<Note[]> {
  const db = getDB();
  const index = db.transaction(STORE_NAME).store.index('by-tagColor');
  const allNotes = await index.getAll(tagColor);
  return allNotes
    .filter((note) => !note.isDeleted)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getAllTaggedNotes(): Promise<Note[]> {
  const db = getDB();
  const allNotes = await db.getAll(STORE_NAME);
  return allNotes
    .filter((note) => !note.isDeleted && note.tagColor !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
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
  return note;
}
