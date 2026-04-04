import { useState, useCallback } from 'react';
import type { Note, Category } from '../../types';
import { CATEGORIES } from '../../utils/constants';
import { batchSoftDeleteNote } from '../../db';
import {
  NoteCard,
  EmptyState,
  BatchActionBar,
  FAB,
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
  onCreateNote: () => void;
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
  onCreateNote,
  onViewNote,
  onNotesChange,
  onToast,
}: NoteListPageProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const categoryInfo = CATEGORIES.find((c) => c.key === category)!;

  const handleLongPress = useCallback(() => {
    if (!isBatchMode) {
      onEnterBatchMode();
    }
  }, [isBatchMode, onEnterBatchMode]);

  const handleToggleSelect = useCallback(
    (id: string) => {
      onToggleSelect(id);
    },
    [onToggleSelect]
  );

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

  return (
    <>
      {isBatchMode && (
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
      )}

      {!isBatchMode && (
        <div className="note-list-header">
          <h1 className="note-list-title">{categoryInfo.label}</h1>
        </div>
      )}

      <div
        className={`note-list-page ${isBatchMode ? 'note-list-page-batch' : ''}`}
      >
        <div
          className={`note-list-content ${
            isBatchMode ? 'note-list-content-batch' : ''
          }`}
        >
          {notes.length === 0 ? (
            <EmptyState text={categoryInfo.emptyText} />
          ) : (
            notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isBatchMode={isBatchMode}
                isSelected={selectedIds.has(note.id)}
                onClick={() => onViewNote(note)}
                onLongPress={handleLongPress}
                onToggleSelect={() => handleToggleSelect(note.id)}
              />
            ))
          )}
        </div>
      </div>

      {!isBatchMode && <FAB onClick={onCreateNote} />}

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
    </>
  );
}
