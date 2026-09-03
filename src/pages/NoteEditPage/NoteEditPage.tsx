import { useState, useCallback, useEffect, useRef, useImperativeHandle } from 'react';
import type { Ref } from 'react';
import type { Editor } from '@tiptap/core';
import type { Note, Category, TagColor } from '../../types';
import { createNote, updateNote, softDeleteNote, updateNoteTagColor } from '../../db';
import { getActiveAIModel } from '../../ai/config';
import { optimizeNoteContent } from '../../ai/client';
import { TagSelector, Modal, AISettings } from '../../components';
// 编辑器直接从模块导入（绕过 barrel），确保 Tiptap 只进编辑页懒加载 chunk
import { MarkdownEditor } from '../../components/MarkdownEditor/MarkdownEditor';
import type { MarkdownEditorHandle } from '../../components/MarkdownEditor/MarkdownEditor';
import { EditorToolbar } from '../../components/MarkdownEditor/EditorToolbar';
import { useScrollState } from '../../hooks/useScrollState';
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
  /** 软键盘遮挡高度（App 根经 useKeyboardInset 测量下发），0/未传表示键盘未弹出 */
  keyboardInset?: number;
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
  keyboardInset,
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
  // ===== 编辑器（Tiptap WYSIWYG Markdown） =====
  // sessionKey：笔记会话标识。切换笔记时变化 → 编辑器重挂载（隔离撤销历史）；
  // 新建自动保存转编辑（stayEditing）不切换，避免打断输入
  const [sessionKey, setSessionKey] = useState(() => note?.id ?? 'creating');
  const [editor, setEditor] = useState<Editor | null>(null);
  // 撤销/重做可用态：editor 实例可变，需在每次事务后重读（故存为状态而非渲染时现算）
  const [undoRedo, setUndoRedo] = useState({ undo: false, redo: false });
  const editorHandleRef = useRef<MarkdownEditorHandle>(null);
  // 新建笔记时编辑器就绪后自动聚焦
  const pendingFocusRef = useRef(false);
  // ===== AI 优化相关 =====
  const [showAISettings, setShowAISettings] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  // 滚动容器：正文区（编辑器在其内自然增高，由该容器滚动）
  const contentRef = useRef<HTMLDivElement>(null);
  // 当前编辑笔记的标识：请求返回后若已切换笔记，则丢弃过期的 AI 结果
  const noteKeyRef = useRef<string>(note?.id ?? 'creating');
  // 滚动联动：正文区是编辑页实际的滚动元素，顶/底栏据此玻璃化（纯表现层）
  const isScrolled = useScrollState(contentRef);
  // 软键盘遮挡高度 --kb-inset 由 App 根下发（桌面端 0px），见 NoteEditPage.css
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
      // 新建自动保存转为编辑：不算切换笔记，AI 请求标识保持不变
      stayEditingRef.current = false;
      return;
    }
    noteKeyRef.current = note?.id ?? 'creating';
    setSessionKey(note?.id ?? 'creating');
    setTitle(note?.title ?? '');
    setContent(note?.content ?? '');
    setTagColor(note?.tagColor ?? null);
    setShowDeleteModal(false);
    setHasChanges(false);
  }, [note?.id, isCreating]);

  useEffect(() => {
    if (isCreating) {
      pendingFocusRef.current = true;
    }
  }, [isCreating]);

  useEffect(() => {
    const titleChanged = title !== originalTitle;
    const contentChanged = content !== originalContent;
    const tagChanged = tagColor !== originalTagColor;
    setHasChanges(titleChanged || contentChanged || tagChanged);
  }, [title, content, tagColor, originalTitle, originalContent, originalTagColor]);

  const handleEditorReady = useCallback((instance: Editor | null) => {
    setEditor(instance);
    // 切换笔记会重挂载编辑器，可用态随之归零
    setUndoRedo({ undo: false, redo: false });
    if (instance && pendingFocusRef.current) {
      pendingFocusRef.current = false;
      instance.commands.focus('end');
    }
  }, []);

  const handleEditorChange = useCallback((markdown: string) => {
    setContent(markdown);
  }, []);

  // 任意事务后重读可用态（值不变则返回原对象，避免无谓重渲染）
  const handleEditorTransaction = useCallback(() => {
    setUndoRedo((prev) => {
      const next = { undo: !!editor?.can().undo(), redo: !!editor?.can().redo() };
      return prev.undo === next.undo && prev.redo === next.redo ? prev : next;
    });
  }, [editor]);

  // 键盘弹出/收起（--kb-inset 变化）后的滚动兜底：个别浏览器把光标滚入可视区时
  // 只认键盘上沿、不认底栏占位，这里把光标行校正进正文容器可视区（正常情况为 no-op）
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !editor || !keyboardInset || !editor.isFocused) return;
    const raf = requestAnimationFrame(() => {
      if (!editor.isFocused) return;
      try {
        const coords = editor.view.coordsAtPos(editor.state.selection.from);
        const visibleBottom = container.getBoundingClientRect().bottom - 12;
        if (coords.bottom > visibleBottom) {
          container.scrollTop += coords.bottom - visibleBottom;
        }
      } catch {
        // 取不到选区坐标（文档卸载等）时忽略
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [keyboardInset, editor]);

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

  // ===== AI 优化（结果经统一撤销时间线，Ctrl+Z / 撤销按钮可回退） =====

  const handleOptimize = useCallback(async () => {
    if (isOptimizing) return;
    if (!content.trim()) {
      onToast('请先输入内容');
      return;
    }
    const activeModel = getActiveAIModel();
    if (!activeModel) {
      setShowAISettings(true);
      onToast('请先配置 AI 模型');
      return;
    }
    const requestKey = noteKeyRef.current;
    setIsOptimizing(true);
    try {
      const optimized = await optimizeNoteContent(activeModel, content);
      // 请求期间已切换/退出了笔记：丢弃过期结果，避免覆盖别的笔记
      if (noteKeyRef.current !== requestKey) return;
      setContent(optimized);
      onToast('优化完成，可撤销');
    } catch (error) {
      onToast(error instanceof Error ? error.message : '优化失败');
    } finally {
      setIsOptimizing(false);
    }
  }, [isOptimizing, content, onToast]);

  // 撤销/重做：编辑器统一历史（打字、AI 优化同一条时间线）
  const handleUndo = useCallback(() => {
    editor?.chain().focus().undo().run();
  }, [editor]);

  const handleRedo = useCallback(() => {
    editor?.chain().focus().redo().run();
  }, [editor]);

  const canUndo = undoRedo.undo;
  const canRedo = undoRedo.redo;

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
    <div
      className={`note-edit-page${isOptimizing ? ' is-optimizing' : ''}${
        keyboardInset ? ' is-kb-open' : ''
      }`}
    >
      <div className={`note-edit-header${isScrolled ? ' is-scrolled' : ''}`}>
        <div className="note-edit-actions">
          <button
            className="note-view-action-btn"
            onClick={handleUndo}
            disabled={!canUndo || isOptimizing}
            title="撤销"
            aria-label="撤销"
          >
            <svg viewBox="0 0 24 24">
              <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
            </svg>
          </button>
          <button
            className="note-view-action-btn"
            onClick={handleRedo}
            disabled={!canRedo || isOptimizing}
            title="重做"
            aria-label="重做"
          >
            <svg viewBox="0 0 24 24">
              <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
            </svg>
          </button>
        </div>
        <h1 className="note-edit-title">
          {isCreating ? '新建笔记' : '编辑笔记'}
        </h1>
        <div className="note-edit-actions">
          <button
            className={`note-view-action-btn note-view-action-btn-ai${isOptimizing ? ' is-optimizing' : ''}`}
            onClick={() => void handleOptimize()}
            disabled={isOptimizing}
            title="AI 优化"
            aria-label="AI 优化"
          >
            <svg viewBox="0 0 24 24">
              <path d="m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
            </svg>
          </button>
          <button
            className="note-view-action-btn"
            onClick={() => setShowAISettings(true)}
            title="AI 模型设置"
            aria-label="AI 模型设置"
          >
            <svg viewBox="0 0 24 24">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="note-edit-content" ref={contentRef}>
        <input
          type="text"
          className="note-edit-input-title"
          placeholder="标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <MarkdownEditor
          key={sessionKey}
          ref={editorHandleRef}
          value={content}
          onChange={handleEditorChange}
          onReady={handleEditorReady}
          onTransaction={handleEditorTransaction}
          editable={!isOptimizing}
          placeholder="开始记录..."
        />
      </div>

      <div className={`note-edit-footer${isScrolled ? ' is-scrolled' : ''}`}>
        {editor && <EditorToolbar editor={editor} disabled={isOptimizing} />}
        <div className="note-edit-footer-row">
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

      <AISettings
        isOpen={showAISettings}
        onClose={() => setShowAISettings(false)}
        onToast={onToast}
      />
    </div>
  );
}

export default NoteEditPage;
