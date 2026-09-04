import { useState, useCallback, useRef } from 'react';
import type { Note, Category } from '../../types';
import { CATEGORIES } from '../../utils/constants';
import { batchSoftDeleteNote } from '../../db';
import { useScrollState } from '../../hooks/useScrollState';
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
  // 滚动联动：顶栏玻璃化（纯表现层）
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolled = useScrollState(scrollRef);

  const categoryInfo = CATEGORIES.find((c) => c.key === category)!;

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
      onToast(`已移入回收站 ${selectedIds.size} 条笔记`);
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

  // 长按任意笔记进入多选模式，并选中该笔记
  const handleLongPress = useCallback((noteId: string) => {
    onEnterBatchMode();
    onSelectAll([noteId]);
  }, [onEnterBatchMode, onSelectAll]);

  return (
    <div className="note-list-container">
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
        <div className={`note-list-header${isScrolled ? ' is-scrolled' : ''}`}>
          <h1 className="note-list-title">{categoryInfo.label}</h1>
        </div>
      )}

      <div ref={scrollRef} className={`note-list-scroll${isBatchMode ? ' batch-mode' : ''}`}>
        {notes.length === 0 ? (
          <EmptyState text={categoryInfo.emptyText} />
        ) : (
          notes.map((note, index) => (
            <NoteCard
              key={note.id}
              note={note}
              isBatchMode={isBatchMode}
              isSelected={selectedIds.has(note.id)}
              index={index}
              onClick={() => onViewNote(note)}
              onToggleSelect={() => onToggleSelect(note.id)}
              onLongPress={() => handleLongPress(note.id)}
            />
          ))
        )}
      </div>

      {/* Batch delete modal */}
      <Modal
        isOpen={showDeleteModal}
        title={`确定删除 ${selectedIds.size} 条笔记？`}
        content="删除后可在回收站恢复，保留 15 天"
        cancelText="取消"
        confirmText="删除"
        isDanger={true}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
