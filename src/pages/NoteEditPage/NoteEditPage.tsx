import { useState, useCallback, useEffect, useRef, useImperativeHandle } from 'react';
import type { Ref } from 'react';
import type { Note, Category, TagColor } from '../../types';
import { createNote, updateNote, softDeleteNote, updateNoteTagColor } from '../../db';
import { TagSelector, Modal } from '../../components';
import './NoteEditPage.css';

export interface NoteEditPageHandle {
  /** 请求返回（先保存未落盘的修改），resolve 为是否成功返回 */
  requestBack: () => Promise<boolean>;
  /** 仅保存未落盘的修改，不触发返回。供系统/浏览器返回手势在关闭前保存 */
  saveCurrent: () => Promise<boolean>;
}

interface NoteEditPageProps {
  note?: Note | null;
  category?: Category;
  isCreating: boolean;
  onBack: () => void;
  onSave: (note: Note) => void;
  onDelete?: () => void;
  onToast: (message: string) => void;
  ref?: Ref<NoteEditPageHandle>;
}

export function NoteEditPage({
  note,
  category,
  isCreating,
  onBack,
  onSave,
  onDelete,
  onToast,
  ref,
}: NoteEditPageProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [tagColor, setTagColor] = useState<TagColor | null>(note?.tagColor ?? null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  // 自动保存创建笔记后，避免重置逻辑覆盖本地输入
  const stayEditingRef = useRef(false);
  // 防止自动创建与返回时的保存重复创建笔记
  const createInFlightRef = useRef(false);

  const originalTitle = note?.title ?? '';
  const originalContent = note?.content ?? '';
  const originalTagColor = note?.tagColor ?? null;

  // Reset form state when note or isCreating changes
  useEffect(() => {
    if (stayEditingRef.current) {
      stayEditingRef.current = false;
      return;
    }
    setTitle(note?.title ?? '');
    setContent(note?.content ?? '');
    setTagColor(note?.tagColor ?? null);
    setShowDeleteModal(false);
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

  // 统一的保存逻辑：新建时创建笔记并同步到父组件（后续自动转为更新），编辑时更新笔记
  const performSave = useCallback(async (silent: boolean): Promise<boolean> => {
    if (isCreating) {
      if (!title.trim() && !content.trim()) return true;
      if (!category) return false;
      if (createInFlightRef.current) return true;
      createInFlightRef.current = true;
      try {
        const { note: newNote, warnings } = await createNote({
          title,
          content,
          category,
          tagColor,
        });
        if (warnings.length > 0 && !silent) {
          onToast(warnings[0]);
        }
        stayEditingRef.current = true;
        onSave(newNote);
        return true;
      } catch (error) {
        if (silent) {
          console.error('自动保存失败:', error);
        } else {
          onToast(error instanceof Error ? error.message : '保存失败');
        }
        return false;
      } finally {
        createInFlightRef.current = false;
      }
    }

    if (note) {
      if (!hasChanges) return true;
      // 标题和内容均被清空时不保存
      if (!title.trim() && !content.trim()) return true;
      try {
        const { note: updatedNote, warnings } = await updateNote(note.id, { title, content, tagColor });
        if (warnings.length > 0 && !silent) {
          onToast(warnings[0]);
        }
        onSave(updatedNote);
        return true;
      } catch (error) {
        if (silent) {
          console.error('自动保存失败:', error);
        } else {
          onToast(error instanceof Error ? error.message : '保存失败');
        }
        return false;
      }
    }

    return true;
  }, [isCreating, note, category, title, content, tagColor, hasChanges, onSave, onToast]);

  // 自动保存：停止输入 3 秒后触发
  useEffect(() => {
    if (!isCreating && !note) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      performSave(true);
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, content, tagColor, isCreating, note, performSave]);

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

  // 返回前先保存未落盘的修改
  const handleBack = useCallback(async (): Promise<boolean> => {
    const saved = await performSave(false);
    if (saved) {
      onBack();
      return true;
    }
    return false;
  }, [performSave, onBack]);

  // 仅保存未落盘的修改，不触发返回（用于系统/浏览器返回手势）
  const saveCurrent = useCallback(async (): Promise<boolean> => {
    return performSave(false);
  }, [performSave]);

  // 供侧滑返回手势调用：与页脚返回按钮走同一套保存逻辑；
  // saveCurrent 供系统/浏览器返回手势在关闭前保存未落盘的修改
  useImperativeHandle(ref, () => ({ requestBack: handleBack, saveCurrent }), [handleBack, saveCurrent]);

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
        <div style={{ flex: 1 }} />
        <TagSelector selectedTag={tagColor} onChange={handleTagChange} />
        {!isCreating && (
          <button
            className="note-view-action-btn note-view-action-btn-delete"
            onClick={() => setShowDeleteModal(true)}
            title="删除"
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        )}
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
