import { useState, useCallback, useEffect, useRef } from 'react';
import type { Note, Category, TagColor } from '../../types';
import { createNote, updateNote, softDeleteNote, updateNoteTagColor } from '../../db';
import { TagSelector, Modal } from '../../components';
import { TAG_COLORS } from '../../utils/constants';
import './NoteEditPage.css';

interface NoteEditPageProps {
  note?: Note | null;
  category?: Category;
  isCreating: boolean;
  onBack: () => void;
  onSave: (note: Note) => void;
  onDelete?: () => void;
  onToast: (message: string) => void;
}

export function NoteEditPage({
  note,
  category,
  isCreating,
  onBack,
  onSave,
  onDelete,
  onToast,
}: NoteEditPageProps) {
  const [isEditing, setIsEditing] = useState(isCreating);
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [tagColor, setTagColor] = useState<TagColor | null>(note?.tagColor ?? null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const originalTitle = note?.title ?? '';
  const originalContent = note?.content ?? '';
  const originalTagColor = note?.tagColor ?? null;

  // Reset form state when note or isCreating changes
  useEffect(() => {
    setIsEditing(isCreating);
    setTitle(note?.title ?? '');
    setContent(note?.content ?? '');
    setTagColor(note?.tagColor ?? null);
    setShowDeleteModal(false);
    setShowDiscardModal(false);
    setHasChanges(false);
  }, [note?.id, isCreating]);

  useEffect(() => {
    if (isCreating && contentRef.current) {
      contentRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    const titleChanged = title !== originalTitle;
    const contentChanged = content !== originalContent;
    const tagChanged = tagColor !== originalTagColor;
    setHasChanges(titleChanged || contentChanged || tagChanged);
  }, [title, content, tagColor, originalTitle, originalContent, originalTagColor]);

  useEffect(() => {
    if (!isCreating && !isEditing) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      if (title.trim() || content.trim()) {
        handleAutoSave();
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, content, tagColor]);

  const handleAutoSave = useCallback(async () => {
    if (isCreating) return;
    if (!note) return;
    if (!hasChanges) return;

    try {
      await updateNote(note.id, { title, content, tagColor });
    } catch (error) {
      console.error('自动保存失败:', error);
    }
  }, [isCreating, note, title, content, tagColor, hasChanges]);

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle && !trimmedContent) {
      onToast('请输入标题或内容');
      return;
    }

    try {
      if (isCreating) {
        if (!category) {
          onToast('分类错误');
          return;
        }
        const { note: newNote, warnings } = await createNote({
          title,
          content,
          category,
          tagColor,
        });
        if (warnings.length > 0) {
          onToast(warnings[0]);
        } else {
          onToast('已保存');
        }
        onSave(newNote);
        setIsEditing(false);
      } else if (note) {
        const { note: updatedNote, warnings } = await updateNote(note.id, { title, content, tagColor });
        if (warnings.length > 0) {
          onToast(warnings[0]);
        } else {
          onToast('已保存');
        }
        onSave(updatedNote);
        setIsEditing(false);
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : '保存失败');
    }
  }, [isCreating, note, category, title, content, tagColor, onSave, onToast]);

  const handleTagChange = useCallback(async (newTag: TagColor | null) => {
    setTagColor(newTag);
    if (!isCreating && note) {
      try {
        await updateNoteTagColor(note.id, newTag);
        if (newTag) {
          const tagName = newTag === 'red' ? '红色' : newTag === 'orange' ? '橙色' : newTag === 'yellow' ? '黄色' : '灰色';
          onToast(`已标记为${tagName}标签`);
        } else {
          onToast('已取消标签');
        }
      } catch (error) {
        onToast(error instanceof Error ? error.message : '标签更新失败');
      }
    }
  }, [isCreating, note, onToast]);

  const handleDelete = useCallback(async () => {
    if (!note) return;
    try {
      await softDeleteNote(note.id);
      onToast('已删除');
      if (onDelete) onDelete();
    } catch (error) {
      onToast(error instanceof Error ? error.message : '删除失败');
    }
    setShowDeleteModal(false);
  }, [note, onDelete, onToast]);

  const handleBack = useCallback(() => {
    if (isCreating) {
      if (title.trim() || content.trim()) {
        setShowDiscardModal(true);
      } else {
        onBack();
      }
    } else if (isEditing) {
      if (hasChanges) {
        setShowDiscardModal(true);
      } else {
        setIsEditing(false);
      }
    } else {
      onBack();
    }
  }, [isCreating, isEditing, hasChanges, title, content, onBack]);

  const handleConfirmDiscard = useCallback(() => {
    if (isCreating) {
      onBack();
    } else if (isEditing) {
      setTitle(originalTitle);
      setContent(originalContent);
      setTagColor(originalTagColor);
      setIsEditing(false);
    }
    setShowDiscardModal(false);
  }, [isCreating, isEditing, originalTitle, originalContent, originalTagColor, onBack]);

  const handleSaveAndExit = useCallback(async () => {
    if (isCreating) {
      if (title.trim() || content.trim()) {
        await handleSave();
      } else {
        onBack();
      }
    } else if (isEditing) {
      await handleSave();
      setIsEditing(false);
    }
    setShowDiscardModal(false);
  }, [isCreating, isEditing, title, content, handleSave, onBack]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (!isEditing && note) {
    const tagInfo = note.tagColor ? TAG_COLORS.find(t => t.key === note.tagColor) : null;

    return (
      <div className="note-edit-page">
        <div className="note-edit-header">
          <div className="note-edit-actions" />
          <h1 className="note-edit-title">笔记详情</h1>
          <div className="note-edit-actions" />
        </div>

        <div className="note-edit-view-content">
          <div className="note-edit-view-header">
            <h2 className="note-edit-view-title">{note.title || '(无标题)'}</h2>
            {tagInfo && (
              <div className="note-view-tag-dot" style={{ backgroundColor: tagInfo.value }} />
            )}
          </div>
          <div className="note-edit-view-body">{note.content}</div>
          <div className="note-edit-view-created">
            创建于 {formatDate(note.createdAt)}
          </div>
        </div>

        <div className="note-view-footer">
          <button
            className="note-view-action-btn"
            onClick={handleBack}
            title="返回"
          >
            <svg viewBox="0 0 24 24">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="note-view-action-btn note-view-action-btn-delete"
            onClick={() => setShowDeleteModal(true)}
            title="删除"
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
          <button
            className="note-view-action-btn"
            onClick={() => setIsEditing(true)}
            title="编辑"
          >
            <svg viewBox="0 0 24 24">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </button>
        </div>

        <Modal
          isOpen={showDeleteModal}
          title="确定删除这条笔记？"
          content="删除后无法恢复"
          cancelText="取消"
          confirmText="删除"
          isDanger={true}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      </div>
    );
  }

  return (
    <div className="note-edit-page">
      <div className="note-edit-header">
        <div className="note-edit-actions" />
        <h1 className="note-edit-title">
          {isCreating ? '新建笔记' : '编辑笔记'}
        </h1>
        <div className="note-edit-actions" />
      </div>

      <div className="note-edit-content">
        <input
          type="text"
          className="note-edit-input-title"
          placeholder="标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="note-edit-divider" />
        <textarea
          ref={contentRef}
          className="note-edit-input-content"
          placeholder="开始记录..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <div className="note-edit-footer">
        <button
          className="note-view-action-btn"
          onClick={handleBack}
          title="返回"
        >
          <svg viewBox="0 0 24 24">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <TagSelector selectedTag={tagColor} onChange={handleTagChange} />
        <button className="note-edit-save-btn" onClick={handleSave}>
          保存
        </button>
      </div>

      <Modal
        isOpen={showDeleteModal}
        title="确定删除这条笔记？"
        content="删除后无法恢复"
        cancelText="取消"
        confirmText="删除"
        isDanger={true}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
      />

      <Modal
        isOpen={showDiscardModal}
        title={isCreating ? '是否保存草稿？' : '有未保存的修改，是否保存？'}
        content=""
        cancelText="不保存"
        confirmText="保存"
        onCancel={handleConfirmDiscard}
        onConfirm={handleSaveAndExit}
      />
    </div>
  );
}
