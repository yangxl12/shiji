import type { Note } from '../types';
import { getDB } from '../db';
import { STORE_NAME } from '../utils/constants';
import { fetchRemoteNotes, pushRemoteNotes, setLastSyncTime, type SyncConfig } from './gist';

/**
 * 同步核心逻辑：拉取远端 → 按 updatedAt 合并（LWW，新者胜）→ 本地有差异则推送。
 * 注意：此模块直接使用底层 db API 写入，不经过业务封装，
 * 因此不会触发 db 层的数据变更通知（避免 pull → push 循环）。
 */

export interface SyncResult {
  /** 从远端更新到本地的笔记条数 */
  pulled: number;
  /** 是否推送了本地变更到远端 */
  pushed: boolean;
}

/** 读取本地全量笔记（含软删除，删除标记也需要同步） */
export async function getAllNotesRaw(): Promise<Note[]> {
  const db = getDB();
  return db.getAll(STORE_NAME);
}

/** 判断两组笔记是否一致（按 id + updatedAt + isDeleted 比较） */
function payloadEquals(a: Note[], b: Note[]): boolean {
  if (a.length !== b.length) return false;
  const mapB = new Map(b.map((n) => [n.id, n]));
  return a.every((n) => {
    const m = mapB.get(n.id);
    return m !== undefined && m.updatedAt === n.updatedAt && m.isDeleted === n.isDeleted;
  });
}

/**
 * 执行一次完整同步：
 * 1. 拉取远端笔记，远端较新的写入本地
 * 2. 若合并后本地与远端不一致（本地有更新），推送本地全量到远端
 */
export async function runSync(config: SyncConfig): Promise<SyncResult> {
  const remote = await fetchRemoteNotes(config);
  const db = getDB();
  const local = await db.getAll(STORE_NAME);

  // 首次同步：远端没有数据文件，推送本地全量（空数组也推，顺带验证写权限）
  if (remote === null) {
    await pushRemoteNotes(config, local);
    setLastSyncTime(Date.now());
    return { pulled: 0, pushed: true };
  }

  // 合并：远端较新的笔记覆盖本地（LWW）
  const localMap = new Map(local.map((n) => [n.id, n]));
  let pulled = 0;
  for (const remoteNote of remote) {
    const localNote = localMap.get(remoteNote.id);
    if (!localNote || remoteNote.updatedAt > localNote.updatedAt) {
      await db.put(STORE_NAME, remoteNote);
      localMap.set(remoteNote.id, remoteNote);
      pulled++;
    }
  }

  // 本地存在更新（或合并结果与远端不一致）时推送
  const merged = Array.from(localMap.values());
  let pushed = false;
  if (!payloadEquals(remote, merged)) {
    await pushRemoteNotes(config, merged);
    pushed = true;
  }

  setLastSyncTime(Date.now());
  return { pulled, pushed };
}

/** 仅推送本地全量到远端（本地数据变更后调用） */
export async function pushOnly(config: SyncConfig): Promise<void> {
  const local = await getAllNotesRaw();
  await pushRemoteNotes(config, local);
  setLastSyncTime(Date.now());
}
