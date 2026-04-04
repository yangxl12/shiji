import { useState, useMemo, useCallback } from 'react';
import type { Note, TagColor } from '../../types';
import {
  NoteCard,
  EmptyState,
  TagChipNav,
  BatchActionBar,
  Modal,
} from '../../components';
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

  const filteredNotes = useMemo(() => {
    if (selectedTag === 'all') {
      return notes;
    }
    return notes.filter((note) => note.tagColor === selectedTag);
  }, [notes, selectedTag]);

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

  const getEmptyText = () => {
    if (selectedTag === 'all') {
      return '还没有被标记的笔记';
    }
    return '暂无此标签的笔记';
  };

  return (
    <>
      {!isBatchMode && (
        <TagChipNav selectedTag={selectedTag} onSelect={setSelectedTag} />
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

      <div className="tags-page">
        {filteredNotes.length === 0 ? (
          <EmptyState text={getEmptyText()} />
        ) : (
          filteredNotes.map((note) => (
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
