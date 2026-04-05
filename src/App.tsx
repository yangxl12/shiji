import { useState, useEffect, useCallback } from 'react';
import type { Note, Category, TabType, ToastMessage } from './types';
import { initDB, getNotesByCategory, getAllTaggedNotes } from './db';
import { TabBar, ToastContainer } from './components';
import { NoteListPage, TagsPage, NoteEditPage } from './pages';
import './App.css';

type PageType = 'list' | 'create' | 'detail';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('impromptu');
  const [currentPage, setCurrentPage] = useState<PageType>('list');
  const [notes, setNotes] = useState<Note[]>([]);
  const [taggedNotes, setTaggedNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [createCategory, setCreateCategory] = useState<Category>('impromptu');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    setToasts((prev) => [...prev, { id, message }]);
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      if (activeTab === 'tags') {
        const allTagged = await getAllTaggedNotes();
        setTaggedNotes(allTagged);
      } else {
        const categoryNotes = await getNotesByCategory(activeTab);
        setNotes(categoryNotes);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载失败');
    }
  }, [activeTab, showToast]);

  useEffect(() => {
    const init = async () => {
      try {
        await initDB();
        await loadNotes();
        setIsLoading(false);
      } catch (error) {
        setDbError(error instanceof Error ? error.message : '初始化失败');
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isLoading && !dbError) {
      loadNotes();
    }
  }, [activeTab, loadNotes]);

  useEffect(() => {
    if (!isLoading && !dbError && currentPage === 'list') {
      loadNotes();
    }
  }, [currentPage, isLoading, dbError, loadNotes]);

  const handleCloseToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage('list');
    setIsBatchMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleCreateNote = useCallback(() => {
    setCurrentNote(null);
    // 记录当前分类用于创建笔记，标签页则使用默认分类
    if (activeTab !== 'tags') {
      setCreateCategory(activeTab);
    }
    setCurrentPage('create');
  }, [activeTab]);

  const handleViewNote = useCallback((note: Note) => {
    setCurrentNote(note);
    setCurrentPage('detail');
  }, []);

  const handleBackToList = useCallback(() => {
    setCurrentPage('list');
    setCurrentNote(null);
  }, []);

  const handleSaveNote = useCallback((savedNote: Note) => {
    setCurrentNote(savedNote);
    setCurrentPage('detail');
  }, []);

  const handleDeleteNote = useCallback(() => {
    setCurrentPage('list');
    setCurrentNote(null);
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
        <div className="app-loading-text">加载中...</div>
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

  if (currentPage === 'create' || currentPage === 'detail') {
    const isCreating = currentPage === 'create';
    return (
      <>
        <NoteEditPage
          note={currentNote}
          category={createCategory}
          isCreating={isCreating}
          onBack={handleBackToList}
          onSave={handleSaveNote}
          onDelete={handleDeleteNote}
          onToast={showToast}
        />
        <ToastContainer toasts={toasts} onClose={handleCloseToast} />
      </>
    );
  }

  return (
    <div className="app">
      {activeTab !== 'tags' ? (
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
          onCreateNote={handleCreateNote}
          onViewNote={handleViewNote}
          onNotesChange={loadNotes}
          onToast={showToast}
        />
      ) : (
        <TagsPage
          notes={taggedNotes}
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
      {!isBatchMode && <TabBar activeTab={activeTab} onTabChange={handleTabChange} />}
      <ToastContainer toasts={toasts} onClose={handleCloseToast} />
    </div>
  );
}

export default App;
