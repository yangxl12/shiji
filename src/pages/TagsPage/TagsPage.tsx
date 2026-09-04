import { useState, useMemo, useCallback, useRef } from 'react';
import type { Note, TagColor } from '../../types';
import {
  NoteCard,
  EmptyState,
  TagChipNav,
  BatchActionBar,
  Modal,
} from '../../components';
import { useScrollState } from '../../hooks/useScrollState';
import { exportNotes } from '../../utils/export';
import './TagsPage.css';

interface TagsPageProps {
  notes: Note[];  // tagged notes for display (按具体标签筛选时使用)
  allNotes: Note[];  // all notes for export & "全部"筛选（含未标记笔记）
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

// Export icon
const ExportIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
  </svg>
);

export function TagsPage({
  notes,
  allNotes,
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
  // 滚动联动：顶栏玻璃化（纯表现层）
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolled = useScrollState(scrollRef);

  const filteredNotes = useMemo(() => {
    if (selectedTag === 'all') {
      // "全部"展示所有笔记（含未标记笔记）
      return allNotes;
    }
    return notes.filter((note) => note.tagColor === selectedTag);
  }, [notes, allNotes, selectedTag]);

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

  // Handle export - export ALL notes, not just filtered
  const handleExport = useCallback(async () => {
    if (allNotes.length === 0) {
      onToast('没有可导出的笔记');
      return;
    }

    onToast('正在导出...');
    
    try {
      const result = await exportNotes(allNotes, (progress) => {
        onToast(`正在导出... (${progress.fileIndex}/${Math.ceil(allNotes.length / 10)})`);
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
  }, [allNotes, onToast]);

  const getEmptyText = () => {
    if (selectedTag === 'all') {
      return '还没有笔记';
    }
    return '暂无此标签的笔记';
  };

  return (
    <>
      {!isBatchMode && (
        <div className={`tags-header${isScrolled ? ' is-scrolled' : ''}`}>
          <TagChipNav selectedTag={selectedTag} onSelect={setSelectedTag} />
          <div className="tags-header-actions">
            <button
              className="tags-export-btn"
              onClick={handleExport}
              disabled={allNotes.length === 0}
              title="导出全部"
            >
              <ExportIcon />
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

      <div ref={scrollRef} className={`tags-page ${isBatchMode ? 'tags-page-batch' : ''}`}>
        {filteredNotes.length === 0 ? (
          <EmptyState text={getEmptyText()} />
        ) : (
          filteredNotes.map((note, index) => (
            <NoteCard
              key={note.id}
              note={note}
              isBatchMode={isBatchMode}
              isSelected={selectedIds.has(note.id)}
              index={index}
              onClick={() => onViewNote(note)}
              onToggleSelect={() => handleToggleSelect(note.id)}
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
    </>
  );
}
