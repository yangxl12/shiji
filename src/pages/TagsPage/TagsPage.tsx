import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Note, TagColor } from '../../types';
import {
  NoteCard,
  EmptyState,
  TagChipNav,
  BatchActionBar,
  Modal,
} from '../../components';
import { softDeleteNote } from '../../db';
import { exportNotes } from '../../utils/export';
import './TagsPage.css';

interface TagsPageProps {
  notes: Note[];
  isBatchMode: boolean;
  selectedIds: Set<string>;
  onEnterBatchMode: () => void;
  onExitBatchMode: () => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onViewNote: (note: Note) => void;
  onNotesChange: () => void;
  onToast: (message: string) => void;
}

// Select/Multi-select icon
const SelectIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M3 5h2v2H3zm0 6h2v2H3zm0 6h2v2H3zM7 5h14v2H7zm0 6h14v2H7zm0 6h14v2H7z" />
  </svg>
);

// Export icon
const ExportIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
  </svg>
);

export function TagsPage({
  notes,
  isBatchMode,
  selectedIds,
  onEnterBatchMode,
  onExitBatchMode,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onViewNote,
  onNotesChange,
  onToast,
}: TagsPageProps) {
  // 默认选中红色标签
  const [selectedTag, setSelectedTag] = useState<TagColor | 'all'>('red');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSingleDeleteModal, setShowSingleDeleteModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [swipedNoteId, setSwipedNoteId] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    if (selectedTag === 'all') {
      return notes;
    }
    return notes.filter((note) => note.tagColor === selectedTag);
  }, [notes, selectedTag]);

  // Close swiped card when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.note-card-wrapper') && swipedNoteId) {
        setSwipedNoteId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [swipedNoteId]);

  const handleToggleSelect = useCallback(
    (id: string) => {
      onToggleSelect(id);
    },
    [onToggleSelect]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredNotes.length) {
      onClearSelection();
    } else {
      onSelectAll(filteredNotes.map((n) => n.id));
    }
  }, [selectedIds.size, filteredNotes, onSelectAll, onClearSelection]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    try {
      const { batchSoftDeleteNote } = await import('../../db');
      await batchSoftDeleteNote(Array.from(selectedIds));
      onToast(`已删除 ${selectedIds.size} 条笔记`);
      onExitBatchMode();
      onClearSelection();
      onNotesChange();
    } catch (error) {
      onToast(error instanceof Error ? error.message : '删除失败');
    }
    setShowDeleteModal(false);
  }, [selectedIds, onToast, onExitBatchMode, onClearSelection, onNotesChange]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
  }, []);

  // Single note delete handlers
  const handleSwipeDelete = useCallback((noteId: string) => {
    setNoteToDelete(noteId);
    setShowSingleDeleteModal(true);
  }, []);

  const handleConfirmSingleDelete = useCallback(async () => {
    if (!noteToDelete) return;
    try {
      await softDeleteNote(noteToDelete);
      onToast('已删除');
      setSwipedNoteId(null);
      onNotesChange();
    } catch (error) {
      onToast(error instanceof Error ? error.message : '删除失败');
    }
    setShowSingleDeleteModal(false);
    setNoteToDelete(null);
  }, [noteToDelete, onToast, onNotesChange]);

  const handleCancelSingleDelete = useCallback(() => {
    setShowSingleDeleteModal(false);
    setNoteToDelete(null);
  }, []);

  // Handle swipe state
  const handleSwipe = useCallback((noteId: string, isSwiped: boolean) => {
    if (isSwiped) {
      setSwipedNoteId(noteId);
    } else if (swipedNoteId === noteId) {
      setSwipedNoteId(null);
    }
  }, [swipedNoteId]);

  // Enter batch mode - close all swiped cards
  const handleEnterBatch = useCallback(() => {
    setSwipedNoteId(null);
    onEnterBatchMode();
  }, [onEnterBatchMode]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (filteredNotes.length === 0) {
      onToast('没有可导出的笔记');
      return;
    }

    onToast('正在导出...');
    
    try {
      const result = await exportNotes(filteredNotes, (progress) => {
        onToast(`正在导出... (${progress.fileIndex}/${Math.ceil(filteredNotes.length / 10)})`);
      });
      
      if (result.success) {
        onToast(result.message);
      } else {
        onToast(result.message);
      }
    } catch (error) {
      onToast('导出失败，请重试');
      console.error('Export error:', error);
    }
  }, [filteredNotes, onToast]);

  const getEmptyText = () => {
    if (selectedTag === 'all') {
      return '还没有被标记的笔记';
    }
    return '暂无此标签的笔记';
  };

  return (
    <>
      {!isBatchMode && (
        <div className="tags-header">
          <TagChipNav selectedTag={selectedTag} onSelect={setSelectedTag} />
          <div className="tags-header-actions">
            <button
              className="tags-export-btn"
              onClick={handleExport}
              disabled={filteredNotes.length === 0}
              title="导出"
            >
              <ExportIcon />
            </button>
            <button
              className="tags-select-btn"
              onClick={handleEnterBatch}
              disabled={filteredNotes.length === 0}
              title="多选"
            >
              <SelectIcon />
            </button>
          </div>
        </div>
      )}

      {isBatchMode && (
        <BatchActionBar
          selectedCount={selectedIds.size}
          totalCount={filteredNotes.length}
          onCancel={() => {
            onExitBatchMode();
            onClearSelection();
          }}
          onSelectAll={handleSelectAll}
          onDelete={handleDeleteClick}
        />
      )}

      <div className={`tags-page ${isBatchMode ? 'tags-page-batch' : ''}`}>
        {filteredNotes.length === 0 ? (
          <EmptyState text={getEmptyText()} />
        ) : (
          filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isBatchMode={isBatchMode}
              isSelected={selectedIds.has(note.id)}
              isSwiped={swipedNoteId === note.id}
              onClick={() => onViewNote(note)}
              onToggleSelect={() => handleToggleSelect(note.id)}
              onSwipe={(isSwiped) => handleSwipe(note.id, isSwiped)}
              onDelete={() => handleSwipeDelete(note.id)}
            />
          ))
        )}
      </div>

      {/* Batch delete modal */}
      <Modal
        isOpen={showDeleteModal}
        title={`确定删除 ${selectedIds.size} 条笔记？`}
        content="删除后无法恢复"
        cancelText="取消"
        confirmText="删除"
        isDanger={true}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />

      {/* Single delete modal */}
      <Modal
        isOpen={showSingleDeleteModal}
        title="确定删除这条笔记？"
        content="删除后无法恢复"
        cancelText="取消"
        confirmText="删除"
        isDanger={true}
        onCancel={handleCancelSingleDelete}
        onConfirm={handleConfirmSingleDelete}
      />
    </>
  );
}
