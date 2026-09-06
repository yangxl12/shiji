import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import type { CSSProperties } from 'react';
import type { Note, Category, TabType, ToastMessage } from './types';
import { initDB, setDataChangeListener, getAllNotes, purgeExpiredNotes } from './db';
import { TabBar, ToastContainer, FAB, SyncSettings, ThemeToggle, GlobalSearch, type SyncStatus } from './components';
import { NoteListPage, TagsPage, SettingsPage } from './pages';
import type { NoteEditPageHandle } from './pages/NoteEditPage/NoteEditPage';
import { useSwipeBack } from './hooks/useSwipeBack';
import { useTheme } from './hooks/useTheme';
import { useKeyboardInset } from './hooks/useKeyboardInset';
import { getSyncConfig } from './sync/gist';
import { runSync, pushOnly } from './sync/sync';
import { SYNC_PUSH_DEBOUNCE } from './utils/constants';
import './App.css';

type PageType = 'list' | 'create' | 'detail';

// 编辑页（含 Tiptap 编辑器，体积较大）懒加载：首次打开笔记时才拉取
const importNoteEditPage = () => import('./pages/NoteEditPage/NoteEditPage');
const NoteEditPage = lazy(importNoteEditPage);

function App() {
  const [isLoading, setIsLoading] = useState(true);
  // 初始化完成（initDB + 启动同步 + 回收站清理）后才开始拉列表数据
  const [initDone, setInitDone] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('impromptu');
  const [showEditPage, setShowEditPage] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageType>('list');
  const [notes, setNotes] = useState<Note[]>([]);
  const [taggedNotes, setTaggedNotes] = useState<Note[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [createCategory, setCreateCategory] = useState<Category>('impromptu');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // ===== 主题（浅色 / 深色 / 跟随系统） =====
  const { themeMode, setThemeMode } = useTheme();

  // ===== 软键盘遮挡高度（移动端） =====
  // 以 CSS 变量 --kb-inset 下发给子树：编辑页整页与底栏、设置抽屉据此抬到键盘上方
  const keyboardInset = useKeyboardInset();

  // ===== 多端同步（GitHub Gist） =====
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    getSyncConfig() ? 'idle' : 'unconfigured'
  );
  // 同步互斥与防抖推送（同步进行中触发的推送记为 pending，结束后补推）
  const syncingRef = useRef(false);
  const pendingPushRef = useRef(false);
  const pushTimerRef = useRef<number | null>(null);
  const runPushRef = useRef<() => void>(() => {});
  // StrictMode 下 init effect 会执行两次，该标记保证启动同步只跑一次
  const startupSyncedRef = useRef(false);

  // 二级页面（编辑页）容器与手势返回相关引用
  const listPageRef = useRef<HTMLDivElement>(null);
  const editPageRef = useRef<HTMLDivElement>(null);
  const editPageHandleRef = useRef<NoteEditPageHandle>(null);
  const closeTimerRef = useRef<number | null>(null);
  const showEditPageRef = useRef(showEditPage);
  // 编辑页组件首次打开后保持挂载（供滑出动画复用），懒加载由此触发
  const [editPageMounted, setEditPageMounted] = useState(false);
  // 标记返回由应用内触发（返回按钮/侧滑手势），此时保存已在 handleBack 中完成；
  // 系统/浏览器返回手势触发 popstate 时该标记为 false，需在关闭前保存未落盘的修改。
  const appBackRef = useRef(false);

  useEffect(() => {
    showEditPageRef.current = showEditPage;
  }, [showEditPage]);

  const showToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    setToasts((prev) => [...prev, { id, message }]);
  }, []);

  // loadNotes 的引用必须稳定：它是列表页/标签页的 prop，变化会让 memo 全线失效。
  // 因此 activeTab 走 ref 读取，回调自身不随 tab 切换重建。
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const loadNotes = useCallback(async () => {
    try {
      // 一次全表读取 + 内存分组：切 tab / 关闭编辑页不再重复扫库两次
      const all = await getAllNotes();
      setAllNotes(all);

      const tab = activeTabRef.current;
      // 设置页自管理回收站数据，不加载笔记列表
      if (tab === 'settings') return;

      if (tab === 'tags') {
        setTaggedNotes(all.filter((note) => note.tagColor !== null));
      } else {
        setNotes(all.filter((note) => note.category === tab));
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载失败');
    }
  }, [showToast]);

  // ===== 同步逻辑 =====

  // 本地数据变更后的防抖推送（由 db 层监听触发）
  const schedulePush = useCallback(() => {
    if (!getSyncConfig()) return;
    if (pushTimerRef.current !== null) {
      clearTimeout(pushTimerRef.current);
    }
    pushTimerRef.current = window.setTimeout(() => {
      pushTimerRef.current = null;
      runPushRef.current();
    }, SYNC_PUSH_DEBOUNCE);
  }, []);

  const runPush = useCallback(async () => {
    const config = getSyncConfig();
    if (!config) return;
    // 正在同步（如启动拉取/手动同步）时挂起，结束后补推
    if (syncingRef.current) {
      pendingPushRef.current = true;
      return;
    }
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      await pushOnly(config);
      setSyncStatus('ok');
    } catch (error) {
      // 自动推送失败不打断用户，仅标记状态；下次变更或手动同步时会重试
      setSyncStatus('error');
      console.warn('自动推送失败:', error);
    } finally {
      syncingRef.current = false;
      if (pendingPushRef.current) {
        pendingPushRef.current = false;
        schedulePush();
      }
    }
  }, [schedulePush]);

  useEffect(() => {
    runPushRef.current = runPush;
  }, [runPush]);

  // 手动同步（设置面板"立即同步"）：拉取 + 合并 + 推送，带结果提示
  const handleManualSync = useCallback(async () => {
    const config = getSyncConfig();
    if (!config || syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      const result = await runSync(config);
      setSyncStatus('ok');
      if (result.pulled > 0) {
        await loadNotes();
        showToast(`已从云端更新 ${result.pulled} 条笔记`);
      } else {
        showToast('已是最新');
      }
    } catch (error) {
      setSyncStatus('error');
      showToast(error instanceof Error ? error.message : '同步失败');
    } finally {
      syncingRef.current = false;
    }
  }, [loadNotes, showToast]);

  // 设置面板回调
  const handleConfigSaved = useCallback(() => {
    setSyncStatus('idle');
    void handleManualSync();
  }, [handleManualSync]);

  const handleConfigCleared = useCallback(() => {
    if (pushTimerRef.current !== null) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
    pendingPushRef.current = false;
    setSyncStatus('unconfigured');
  }, []);

  // 监听本地数据变更 → 防抖推送
  useEffect(() => {
    setDataChangeListener(schedulePush);
    return () => {
      setDataChangeListener(null);
      if (pushTimerRef.current !== null) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    };
  }, [schedulePush]);

  useEffect(() => {
    const init = async () => {
      try {
        await initDB();
        // 启动同步：已配置则拉取云端较新数据（失败静默，不影响本地使用）
        const config = getSyncConfig();
        if (config && !startupSyncedRef.current) {
          startupSyncedRef.current = true;
          syncingRef.current = true;
          setSyncStatus('syncing');
          try {
            const result = await runSync(config);
            setSyncStatus('ok');
            if (result.pulled > 0) {
              console.log(`启动同步：从云端更新 ${result.pulled} 条笔记`);
            }
          } catch (error) {
            setSyncStatus('error');
            console.warn('启动同步失败:', error);
          } finally {
            syncingRef.current = false;
          }
        }
        // 清理回收站中超过保留期的笔记（启动即检查一次；若已配置同步，
        // 物理删除会经 notifyDataChange → 防抖推送同步到云端）
        await purgeExpiredNotes();
        setInitDone(true);
      } catch (error) {
        setDbError(error instanceof Error ? error.message : '初始化失败');
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // 数据加载：初始化完成后、切 tab 时、编辑页关闭时各跑一次。
  // 合并原先两个 effect（依赖互相牵连会导致同一次切换重复扫库两次）。
  useEffect(() => {
    if (!initDone || dbError || showEditPage) return;
    let cancelled = false;
    void loadNotes().then(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [initDone, dbError, activeTab, showEditPage, loadNotes]);

  // 首屏数据就绪后，趁空闲预拉取编辑页 chunk，避免首次打开笔记时等待（约 170KB gzip）
  useEffect(() => {
    if (isLoading || dbError) return;
    // 与 lazy() 共用同一 import，模块级缓存保证只下载一次
    const preload = () => {
      void importNoteEditPage();
    };
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(preload, { timeout: 3000 });
      return () => window.cancelIdleCallback(idleId);
    }
    // 不支持 requestIdleCallback 的环境（旧版 Safari）退化为延时触发
    const timerId = window.setTimeout(preload, 1500);
    return () => window.clearTimeout(timerId);
  }, [isLoading, dbError]);

  const handleCloseToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 打开编辑页：首次打开时挂载编辑页组件（懒加载触发点）
  const mountEditPage = useCallback(() => {
    setEditPageMounted(true);
  }, []);

  // ===== 返回手势与浏览器历史的集成 =====
  // 打开编辑页时压入一条历史记录，使安卓系统返回手势 / 浏览器返回 / 物理返回键
  // 都会触发 popstate，与应用内返回走同一套滑出动画，互不冲突。
  const openEditPage = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    mountEditPage();
    window.history.pushState({ ynote: 'edit' }, '');
  }, [mountEditPage]);

  // 统一的关闭动画（由 popstate 触发）
  const closeEditPage = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShowEditPage(false);
    closeTimerRef.current = window.setTimeout(() => {
      setCurrentNote(null);
      setCurrentPage('list');
      closeTimerRef.current = null;
    }, 350);
  }, []);

  // 安卓系统返回手势 / 浏览器返回 / history.back() 的统一入口
  useEffect(() => {
    const onPopState = () => {
      if (!showEditPageRef.current) return;
      // 应用内返回（返回按钮/侧滑手势）：保存已在 NoteEditPage.handleBack 中完成，
      // 仅需执行关闭动画
      if (appBackRef.current) {
        appBackRef.current = false;
        closeEditPage();
        return;
      }
      // 系统/浏览器返回手势：先保存未落盘的修改，成功后再关闭，避免丢失数据；
      // 保存失败时不关闭页面（performSave 内部已 toast 提示），由用户决定后续操作
      const handle = editPageHandleRef.current;
      if (handle) {
        void handle.saveCurrent().then((ok) => {
          if (ok) closeEditPage();
        });
      } else {
        closeEditPage();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [closeEditPage]);

  // 清理刷新等场景残留的编辑页历史状态
  useEffect(() => {
    const state = window.history.state as { ynote?: string } | null;
    if (state?.ynote) {
      window.history.replaceState(null, '');
    }
  }, []);

  // 左侧边缘右滑返回手势（跟手拖拽；右侧左滑由系统手势处理）
  useSwipeBack(editPageRef, listPageRef, {
    enabled: showEditPage,
    onBack: async () => {
      const handle = editPageHandleRef.current;
      if (!handle) return false;
      return handle.requestBack();
    },
  });

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    // If on edit page, animate back to list first
    if (showEditPageRef.current) {
      window.history.back();
    }
    setIsBatchMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleCreateNote = useCallback(() => {
    setCurrentNote(null);
    if (activeTab !== 'tags' && activeTab !== 'settings') {
      setCreateCategory(activeTab);
    }
    setCurrentPage('create');
    setShowEditPage(true);
    openEditPage();
  }, [activeTab, openEditPage]);

  const handleViewNote = useCallback((note: Note) => {
    setCurrentNote(note);
    setCurrentPage('detail');
    setShowEditPage(true);
    openEditPage();
  }, [openEditPage]);

  const handleBackToList = useCallback(() => {
    // 标记为应用内触发返回，供 onPopState 区分：此时保存已在 handleBack 中完成
    appBackRef.current = true;
    window.history.back();
  }, []);

  const handleSaveNote = useCallback((savedNote: Note) => {
    setCurrentNote(savedNote);
    setCurrentPage('detail');
    // Stay on edit page, no animation
  }, []);

  const handleDeleteNote = useCallback(() => {
    window.history.back();
  }, []);

  const handleEnterBatchMode = useCallback(() => {
    setIsBatchMode(true);
  }, []);

  const handleExitBatchMode = useCallback(() => {
    setIsBatchMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-dots" role="status" aria-label="加载中">
          <span className="app-loading-dot" />
          <span className="app-loading-dot" />
          <span className="app-loading-dot" />
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="app-error">
        <div className="app-error-title">存储初始化失败</div>
        <div className="app-error-text">{dbError}</div>
      </div>
    );
  }

  const isCreating = currentPage === 'create';

  return (
    <div className="app" style={{ '--kb-inset': `${keyboardInset}px` } as CSSProperties}>
      {/* List Page - Always rendered */}
      <div
        className={`app-page app-page-list ${showEditPage ? 'page-list-behind' : ''}`}
        ref={listPageRef}
      >
        {activeTab === 'settings' ? (
          <SettingsPage
            themeMode={themeMode}
            onThemeChange={setThemeMode}
            onOpenSyncSettings={() => setShowSyncSettings(true)}
            onToast={showToast}
          />
        ) : activeTab !== 'tags' ? (
          <NoteListPage
            category={activeTab}
            notes={notes}
            isBatchMode={isBatchMode}
            selectedIds={selectedIds}
            onEnterBatchMode={handleEnterBatchMode}
            onExitBatchMode={handleExitBatchMode}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onViewNote={handleViewNote}
            onNotesChange={loadNotes}
            onToast={showToast}
          />
        ) : (
          <TagsPage
            notes={taggedNotes}
            allNotes={allNotes}
            isBatchMode={isBatchMode}
            selectedIds={selectedIds}
            onEnterBatchMode={handleEnterBatchMode}
            onExitBatchMode={handleExitBatchMode}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onViewNote={handleViewNote}
            onNotesChange={loadNotes}
            onToast={showToast}
          />
        )}
      </div>

      {/* TabBar - Fixed at bottom, outside of scrollable page */}
      {!isBatchMode && !showEditPage && (
        <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* FAB - Fixed at bottom right, outside of scrollable page */}
      {!isBatchMode && !showEditPage && activeTab !== 'tags' && activeTab !== 'settings' && (
        <FAB onClick={handleCreateNote} />
      )}

      {/* 搜索入口 - 右上角（主题按钮左侧），批量模式/编辑页/设置页隐藏 */}
      {!isBatchMode && !showEditPage && activeTab !== 'settings' && (
        <GlobalSearch
          notes={allNotes}
          keyboardInset={keyboardInset}
          onViewNote={handleViewNote}
        />
      )}

      {/* 主题切换按钮 - 右上角（同步按钮左侧），批量模式/编辑页/设置页隐藏 */}
      {!isBatchMode && !showEditPage && activeTab !== 'settings' && (
        <ThemeToggle mode={themeMode} onChange={setThemeMode} onToast={showToast} />
      )}

      {/* 同步状态按钮 - 笔记列表页右上角（标签页右上角已有导出按钮，不重复放置） */}
      {!isBatchMode && !showEditPage && activeTab !== 'tags' && activeTab !== 'settings' && (
        <button
          className={`sync-status-btn sync-status-btn-${syncStatus}`}
          onClick={() => setShowSyncSettings(true)}
          aria-label="多端同步设置"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
          </svg>
        </button>
      )}

      {/* 多端同步设置面板 */}
      <SyncSettings
        isOpen={showSyncSettings}
        syncStatus={syncStatus}
        onClose={() => setShowSyncSettings(false)}
        onManualSync={handleManualSync}
        onConfigSaved={handleConfigSaved}
        onConfigCleared={handleConfigCleared}
      />

      {/* Edit Page - 首次打开后保持挂载（动画用），可见性由 CSS 控制 */}
      {editPageMounted && (
        <div
          className={`app-page app-page-edit ${showEditPage ? 'page-edit-visible' : ''}`}
          ref={editPageRef}
        >
          <Suspense fallback={null}>
            <NoteEditPage
              ref={editPageHandleRef}
              note={currentNote}
              category={createCategory}
              isCreating={isCreating}
              keyboardInset={keyboardInset}
              onBack={handleBackToList}
              onSave={handleSaveNote}
              onDelete={handleDeleteNote}
              onToast={showToast}
            />
          </Suspense>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={handleCloseToast} />
    </div>
  );
}

export default App;
