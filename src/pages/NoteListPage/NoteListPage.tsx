import { memo, useState, useCallback, useRef } from 'react';
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

function NoteListPageInner({
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
          // 回调直接透传父级稳定引用（不在 render 里造新函数），
          // 配合 NoteCard 的 memo：勾选/滚动/顶栏状态变化只重渲染受影响的卡片
          notes.map((note, index) => (
            <NoteCard
              key={note.id}
              note={note}
              isBatchMode={isBatchMode}
              isSelected={selectedIds.has(note.id)}
              index={index}
              onOpen={onViewNote}
              onToggleSelect={onToggleSelect}
              onLongPress={handleLongPress}
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

/** memo：App 级状态（toast / 同步状态 / 键盘高度）变化时不再连带重渲染整列表 */
export const NoteListPage = memo(NoteListPageInner);
