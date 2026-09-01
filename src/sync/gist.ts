import type { Note, Category, TagColor } from '../types';

/**
 * GitHub Gist 同步：配置存取与 REST API 封装。
 * 笔记全量（含软删除）序列化为一个 notes.json 存在 secret Gist 中。
 */

export interface SyncConfig {
  token: string;
  gistId: string;
}

const CONFIG_STORAGE_KEY = 'shiJi-sync-config';
const LAST_SYNC_STORAGE_KEY = 'shiJi-sync-last';
const GIST_FILENAME = 'notes.json';
const GIST_API_BASE = 'https://api.github.com';

export class GistApiError extends Error {}

// ===== 配置存取（localStorage，仅存于本机浏览器） =====

export function getSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; gistId?: string };
    if (parsed.token && parsed.gistId) {
      return { token: parsed.token, gistId: parsed.gistId };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig): void {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function clearSyncConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
  localStorage.removeItem(LAST_SYNC_STORAGE_KEY);
}

export function getLastSyncTime(): number | null {
  const raw = localStorage.getItem(LAST_SYNC_STORAGE_KEY);
  if (!raw) return null;
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : null;
}

export function setLastSyncTime(ts: number): void {
  localStorage.setItem(LAST_SYNC_STORAGE_KEY, String(ts));
}

// ===== REST API =====

async function gistRequest(
  config: SyncConfig,
  init: RequestInit = {}
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${GIST_API_BASE}/gists/${config.gistId}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        ...init.headers,
      },
    });
  } catch {
    throw new GistApiError('网络连接失败，请检查网络');
  }
  if (res.status === 401) {
    throw new GistApiError('Token 无效或已过期，请重新生成');
  }
  if (res.status === 404) {
    throw new GistApiError('Gist 不存在，请检查 Gist ID');
  }
  if (res.status === 403) {
    throw new GistApiError('API 请求受限，请稍后再试');
  }
  if (!res.ok) {
    throw new GistApiError(`GitHub 接口错误（${res.status}）`);
  }
  return res;
}

/** 校验远端数据格式，过滤脏数据 */
function sanitizeNote(raw: unknown): Note | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const n = raw as Record<string, unknown>;
  if (typeof n.id !== 'string' || n.id.length === 0) return null;

  const category: Category =
    n.category === 'study' || n.category === 'todo' ? n.category : 'impromptu';
  const tagColor: TagColor | null =
    n.tagColor === 'red' || n.tagColor === 'orange' || n.tagColor === 'yellow' || n.tagColor === 'gray'
      ? n.tagColor
      : null;

  return {
    id: n.id,
    title: typeof n.title === 'string' ? n.title : '',
    content: typeof n.content === 'string' ? n.content : '',
    category,
    tagColor,
    createdAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now(),
    updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
    isDeleted: n.isDeleted === true,
  };
}

function parseNotesPayload(text: string): Note[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GistApiError('远端数据格式错误（JSON 解析失败）');
  }
  if (!Array.isArray(data)) {
    throw new GistApiError('远端数据格式错误（应为笔记数组）');
  }
  return data.map(sanitizeNote).filter((n): n is Note => n !== null);
}

/**
 * 拉取远端笔记。返回 null 表示 Gist 中还没有数据文件（首次同步）。
 */
export async function fetchRemoteNotes(config: SyncConfig): Promise<Note[] | null> {
  const res = await gistRequest(config);
  const data = await res.json();
  const file = data?.files?.[GIST_FILENAME];
  if (!file || typeof file.content !== 'string') {
    return null;
  }
  if (file.truncated && typeof file.raw_url === 'string') {
    // 内容超过 1MB 被截断，需拉取原始内容（secret gist 的 raw 链接自带访问散列）
    const raw = await fetch(file.raw_url);
    if (!raw.ok) {
      throw new GistApiError('获取远端完整数据失败');
    }
    return parseNotesPayload(await raw.text());
  }
  return parseNotesPayload(file.content);
}

/**
 * 推送笔记全量到远端（覆盖 notes.json）。
 */
export async function pushRemoteNotes(config: SyncConfig, notes: Note[]): Promise<void> {
  const res = await gistRequest(config, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: '拾记笔记数据（多端同步，请勿手动修改）',
      files: {
        [GIST_FILENAME]: { content: JSON.stringify(notes) },
      },
    }),
  });
  await res.json();
}
