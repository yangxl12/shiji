import { useState, useEffect, useCallback } from 'react';
import type { Note, Category, TabType, ToastMessage } from './types';
import { initDB, getNotesByCategory, getAllTaggedNotes, getAllNotes } from './db';
import { TabBar, ToastContainer, FAB } from './components';
import { NoteListPage, TagsPage, NoteEditPage } from './pages';
import './App.css';

type PageType = 'list' | 'create' | 'detail';

function App() {
  const [isLoading, setIsLoading] = useState(true);
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

  const showToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    setToasts((prev) => [...prev, { id, message }]);
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      // Always load all notes for export
      const all = await getAllNotes();
      setAllNotes(all);

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

  // Refresh notes when returning to list
  useEffect(() => {
    if (!isLoading && !dbError && !showEditPage) {
      loadNotes();
    }
  }, [showEditPage, isLoading, dbError, loadNotes]);

  const handleCloseToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    // If on edit page, animate back to list first
    if (showEditPage) {
      setShowEditPage(false);
      setTimeout(() => {
        setCurrentNote(null);
        setCurrentPage('list');
      }, 350);
    }
    setIsBatchMode(false);
    setSelectedIds(new Set());
  }, [showEditPage]);

  const handleCreateNote = useCallback(() => {
    setCurrentNote(null);
    if (activeTab !== 'tags') {
      setCreateCategory(activeTab);
    }
    setCurrentPage('create');
    setShowEditPage(true);
  }, [activeTab]);

  const handleViewNote = useCallback((note: Note) => {
    setCurrentNote(note);
    setCurrentPage('detail');
    setShowEditPage(true);
  }, []);

  const handleBackToList = useCallback(() => {
    setShowEditPage(false);
    setTimeout(() => {
      setCurrentNote(null);
      setCurrentPage('list');
    }, 350);
  }, []);

  const handleSaveNote = useCallback((savedNote: Note) => {
    setCurrentNote(savedNote);
    setCurrentPage('detail');
    // Stay on edit page, no animation
  }, []);

  const handleDeleteNote = useCallback(() => {
    setShowEditPage(false);
    setTimeout(() => {
      setCurrentNote(null);
      setCurrentPage('list');
    }, 350);
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

  const isCreating = currentPage === 'create';

  return (
    <div className="app">
      {/* List Page - Always rendered */}
      <div className={`app-page app-page-list ${showEditPage ? 'page-list-behind' : ''}`}>
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
      {!isBatchMode && !showEditPage && activeTab !== 'tags' && (
        <FAB onClick={handleCreateNote} />
      )}

      {/* Edit Page - Always rendered, visibility controlled by CSS */}
      <div className={`app-page app-page-edit ${showEditPage ? 'page-edit-visible' : ''}`}>
        <NoteEditPage
          note={currentNote}
          category={createCategory}
          isCreating={isCreating}
          onBack={handleBackToList}
          onSave={handleSaveNote}
          onDelete={handleDeleteNote}
          onToast={showToast}
        />
      </div>

      <ToastContainer toasts={toasts} onClose={handleCloseToast} />
    </div>
  );
}

export default App;
