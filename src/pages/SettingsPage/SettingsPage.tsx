import { useCallback, useEffect, useState } from 'react';
import type { Note } from '../../types';
import type { ThemeMode } from '../../hooks/useTheme';
import { TRASH_RETENTION_DAYS } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/time';
import {
  getDeletedNotes,
  restoreNote,
  hardDeleteNote,
  batchHardDeleteNote,
  purgeExpiredNotes,
} from '../../db';
import { Modal, EmptyState } from '../../components';
import './SettingsPage.css';

interface SettingsPageProps {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  onOpenSyncSettings: () => void;
  onToast: (message: string) => void;
}

type SettingsView = 'main' | 'trash';

const MODE_ORDER: ThemeMode[] = ['light', 'dark', 'system'];
const MODE_LABEL: Record<ThemeMode, string> = {
  light: '浅色模式',
  dark: '深色模式',
  system: '跟随系统',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** 距彻底删除的剩余天数（0 表示今天到期） */
function daysLeft(deletedAt: number): number {
  const elapsed = Date.now() - deletedAt;
  return Math.max(0, TRASH_RETENTION_DAYS - Math.floor(elapsed / DAY_MS));
}

const TrashIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

const ThemeIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
  </svg>
);

const SyncIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
  </svg>
);

const RestoreIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
  </svg>
);

const DeleteIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

export function SettingsPage({
  themeMode,
  onThemeChange,
  onOpenSyncSettings,
  onToast,
}: SettingsPageProps) {
  const [view, setView] = useState<SettingsView>('main');
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  const [showClearModal, setShowClearModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  const refreshTrash = useCallback(async () => {
    try {
      // 进入/操作回收站时顺带清理过期笔记，保证列表与计数实时
      await purgeExpiredNotes();
      const list = await getDeletedNotes();
      setDeletedNotes(list);
      setTrashCount(list.length);
    } catch (error) {
      onToast(error instanceof Error ? error.message : '加载失败');
    }
  }, [onToast]);

  // 挂载即刷新计数（主视图回收站入口的角标）
  useEffect(() => {
    void refreshTrash();
  }, [refreshTrash]);

  const openTrash = useCallback(() => {
    setView('trash');
    void refreshTrash();
  }, [refreshTrash]);

  const backToMain = useCallback(() => {
    setView('main');
    void refreshTrash();
  }, [refreshTrash]);

  const handleThemeClick = useCallback(() => {
    const next = MODE_ORDER[(MODE_ORDER.indexOf(themeMode) + 1) % MODE_ORDER.length];
    onThemeChange(next);
    onToast(`已切换为${MODE_LABEL[next]}`);
  }, [themeMode, onThemeChange, onToast]);

  const handleRestore = useCallback(
    async (note: Note) => {
      try {
        await restoreNote(note.id);
        onToast('已恢复');
        await refreshTrash();
      } catch (error) {
        onToast(error instanceof Error ? error.message : '恢复失败');
      }
    },
    [onToast, refreshTrash]
  );

  const handleConfirmDeleteOne = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await hardDeleteNote(deleteTarget.id);
      onToast('已彻底删除');
      await refreshTrash();
    } catch (error) {
      onToast(error instanceof Error ? error.message : '删除失败');
    }
    setDeleteTarget(null);
  }, [deleteTarget, onToast, refreshTrash]);

  const handleClearTrash = useCallback(async () => {
    try {
      await batchHardDeleteNote(deletedNotes.map((n) => n.id));
      onToast('回收站已清空');
      await refreshTrash();
    } catch (error) {
      onToast(error instanceof Error ? error.message : '清空失败');
    }
    setShowClearModal(false);
  }, [deletedNotes, onToast, refreshTrash]);

  return (
    <div className={`settings-container${view === 'trash' ? ' is-trash' : ''}`}>
      {/* ===== 主视图 ===== */}
      <section className="settings-panel settings-panel-main">
        <header className="settings-header">
          <h1 className="settings-title">设置</h1>
        </header>

        <div className="settings-scroll">
          <button className="settings-item" onClick={openTrash}>
            <span className="settings-item-icon settings-item-icon-trash">
              <TrashIcon />
            </span>
            <span className="settings-item-body">
              <span className="settings-item-title">回收站</span>
              <span className="settings-item-desc">已删除的笔记保留 {TRASH_RETENTION_DAYS} 天</span>
            </span>
            {trashCount > 0 && <span className="settings-item-badge">{trashCount}</span>}
            <ChevronIcon />
          </button>

          <button className="settings-item" onClick={handleThemeClick}>
            <span className="settings-item-icon">
              <ThemeIcon />
            </span>
            <span className="settings-item-body">
              <span className="settings-item-title">外观主题</span>
              <span className="settings-item-desc">浅色 / 深色 / 跟随系统</span>
            </span>
            <span className="settings-item-value">{MODE_LABEL[themeMode]}</span>
          </button>

          <button className="settings-item" onClick={onOpenSyncSettings}>
            <span className="settings-item-icon">
              <SyncIcon />
            </span>
            <span className="settings-item-body">
              <span className="settings-item-title">多端同步</span>
              <span className="settings-item-desc">通过 GitHub Gist 同步笔记</span>
            </span>
            <ChevronIcon />
          </button>
        </div>
      </section>

      {/* ===== 回收站视图 ===== */}
      <section className="settings-panel settings-panel-trash">
        <header className="settings-header">
          <button className="settings-back-btn" onClick={backToMain} aria-label="返回设置">
            <svg viewBox="0 0 24 24">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <h1 className="settings-title">回收站</h1>
          {deletedNotes.length > 0 && (
            <button className="settings-clear-btn" onClick={() => setShowClearModal(true)}>
              清空
            </button>
          )}
        </header>

        <div className="settings-scroll">
          {deletedNotes.length === 0 ? (
            <EmptyState text="回收站是空的" />
          ) : (
            <ul className="trash-list">
              {deletedNotes.map((note) => {
                const deletedAt = note.deletedAt ?? note.updatedAt;
                const left = daysLeft(deletedAt);
                return (
                  <li key={note.id} className="trash-item">
                    <div className="trash-item-body">
                      <div className="trash-item-title">
                        {note.title || '无标题笔记'}
                      </div>
                      <div className="trash-item-meta">
                        删除于 {formatRelativeTime(deletedAt)}
                        {left === 0 ? ' · 今天到期' : ` · 剩余 ${left} 天`}
                      </div>
                    </div>
                    <div className="trash-item-actions">
                      <button
                        className="trash-action-btn"
                        onClick={() => handleRestore(note)}
                        title="恢复"
                        aria-label="恢复"
                      >
                        <RestoreIcon />
                      </button>
                      <button
                        className="trash-action-btn trash-action-btn-danger"
                        onClick={() => setDeleteTarget(note)}
                        title="彻底删除"
                        aria-label="彻底删除"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* 清空回收站确认 */}
      <Modal
        isOpen={showClearModal}
        title="清空回收站？"
        content={`将彻底删除 ${deletedNotes.length} 条笔记，无法恢复`}
        cancelText="取消"
        confirmText="清空"
        isDanger={true}
        onCancel={() => setShowClearModal(false)}
        onConfirm={handleClearTrash}
      />

      {/* 单条彻底删除确认 */}
      <Modal
        isOpen={deleteTarget !== null}
        title="彻底删除这条笔记？"
        content="删除后无法恢复"
        cancelText="取消"
        confirmText="删除"
        isDanger={true}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteOne}
      />
    </div>
  );
}

export default SettingsPage;
