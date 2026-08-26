import { useState, useCallback, useRef, useEffect } from 'react';
import type { Note, Category } from '../../types';
import { CATEGORIES } from '../../utils/constants';
import { batchSoftDeleteNote, softDeleteNote } from '../../db';
import {
  NoteCard,
  EmptyState,
  BatchActionBar,
  Modal,
} from '../../components';
import './NoteListPage.css';

interface NoteListPageProps {
  category: Category;
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

export function NoteListPage({
  category,
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
}: NoteListPageProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSingleDeleteModal, setShowSingleDeleteModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [swipedNoteId, setSwipedNoteId] = useState<string | null>(null);

  const categoryInfo = CATEGORIES.find((c) => c.key === category)!;
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === notes.length) {
      onClearSelection();
    } else {
      onSelectAll(notes.map((n) => n.id));
    }
  }, [selectedIds.size, notes, onSelectAll, onClearSelection]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    try {
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

  // 长按任意笔记进入多选模式，并选中该笔记
  const handleLongPress = useCallback((noteId: string) => {
    setSwipedNoteId(null);
    onEnterBatchMode();
    onSelectAll([noteId]);
  }, [onEnterBatchMode, onSelectAll]);

  return (
    <div ref={containerRef} className="note-list-container">
      {isBatchMode ? (
        <BatchActionBar
          selectedCount={selectedIds.size}
          totalCount={notes.length}
          onCancel={() => {
            onExitBatchMode();
            onClearSelection();
          }}
          onSelectAll={handleSelectAll}
          onDelete={handleDeleteClick}
        />
      ) : (
        <div className="note-list-header">
          <h1 className="note-list-title">{categoryInfo.label}</h1>
        </div>
      )}

      <div className={`note-list-scroll${isBatchMode ? ' batch-mode' : ''}`}>
        {notes.length === 0 ? (
          <EmptyState text={categoryInfo.emptyText} />
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isBatchMode={isBatchMode}
              isSelected={selectedIds.has(note.id)}
              isSwiped={swipedNoteId === note.id}
              onClick={() => onViewNote(note)}
              onToggleSelect={() => onToggleSelect(note.id)}
              onSwipe={(isSwiped) => handleSwipe(note.id, isSwiped)}
              onDelete={() => handleSwipeDelete(note.id)}
              onLongPress={() => handleLongPress(note.id)}
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
    </div>
  );
}
