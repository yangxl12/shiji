import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Ref } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor, EditorEvents } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { exitSuggestion } from '@tiptap/suggestion';
import { createSlashMenuExtension } from './slashMenuExtension';
import type { SlashMenuState } from './slashMenuExtension';
import { SlashMenu } from './SlashMenu';
import './MarkdownEditor.css';

export interface MarkdownEditorHandle {
  /** 聚焦编辑器（默认光标到末尾） */
  focus: (position?: 'start' | 'end') => void;
}

interface MarkdownEditorProps {
  /** Markdown 源文本（受控） */
  value: string;
  /** 编辑器内容变化时回传 Markdown 源文本 */
  onChange: (markdown: string) => void;
  placeholder?: string;
  /** false 时锁定编辑（AI 优化中） */
  editable?: boolean;
  /** 编辑器实例就绪/销毁时通知（撤销重做、工具条命令用） */
  onReady?: (editor: Editor | null) => void;
  /** 任意事务后触发（父组件刷新工具条激活态/撤销可用态） */
  onTransaction?: () => void;
  ref?: Ref<MarkdownEditorHandle>;
}

/** 剪贴板纯文本是否疑似 Markdown（命中常见语法才走 Markdown 解析，普通文本原样插入） */
const MARKDOWN_HINT_PATTERN =
  /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s(\[[ xX]\]\s)?|>\s|\d+[.)]\s|```|\|[^|\n]+\|)|[*_`]{1,3}[^*_`\n]+[*_`]{1,3}|\[[^\]\n]+\]\([^)\n]+\)/;

/** 斜杠菜单插件键（模块级常量：PluginKey 仅作插件状态命名空间，跨实例共享安全） */
const SLASH_MENU_PLUGIN_KEY = new PluginKey('slashMenu');

/** 选区序列化为 Markdown 写入剪贴板（Notion 式：text/plain 即源码） */
function copySelectionAsMarkdown(view: EditorView, event: ClipboardEvent, editor: Editor): boolean {
  const { from, to, empty } = view.state.selection;
  if (empty) return false;
  if (!editor.markdown) return false;
  // doc.cut 截取选区（保留结构），交给 markdown 管理器序列化
  const sliced = view.state.doc.cut(from, to);
  const markdown = editor.markdown.serialize(sliced.toJSON());
  if (!markdown) return false;
  event.preventDefault();
  event.clipboardData?.setData('text/plain', markdown);
  return true;
}

/**
 * 所见即所得 Markdown 编辑器（Tiptap v3 + 官方 markdown 扩展）。
 * 外界只见 Markdown 字符串；breaks:true 保证旧纯文本笔记的单换行渲染不变。
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  editable = true,
  onReady,
  onTransaction,
  ref,
}: MarkdownEditorProps) {
  const [slashState, setSlashState] = useState<SlashMenuState | null>(null);
  const slashMenuElRef = useRef<HTMLDivElement | null>(null);
  // ProseMirror 插件 → React 菜单的键盘桥（命名以 Ref 结尾以标记可变容器语义）
  const keydownRef = useMemo(() => ({ current: null as ((event: KeyboardEvent) => boolean) | null }), []);

  const editorRef = useRef<Editor | null>(null);
  const lastEmittedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onTransactionRef = useRef(onTransaction);

  useEffect(() => {
    onChangeRef.current = onChange;
    onTransactionRef.current = onTransaction;
  });

  const extensions = useMemo(() => {
    return [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      // breaks: 单换行即换行 —— 兼容存量纯文本笔记的换行习惯
      Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { cellMinWidth: 60 } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      createSlashMenuExtension({
        pluginKey: SLASH_MENU_PLUGIN_KEY,
        keydownRef,
        onStateChange: setSlashState,
      }),
    ];
  }, [placeholder, keydownRef]);

  const editor = useEditor({
    extensions,
    content: value,
    contentType: 'markdown',
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'md-prose', 'aria-label': '笔记正文' },
      // 纯文本粘贴疑似 Markdown 时按 Markdown 解析（富文本粘贴仍走 ProseMirror HTML 解析）
      handlePaste: (_view, event) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;
        if (clipboard.getData('text/html').trim() !== '') return false;
        const text = clipboard.getData('text/plain');
        if (!text || !MARKDOWN_HINT_PATTERN.test(text)) return false;
        event.preventDefault();
        editorRef.current?.commands.insertContent(text, { contentType: 'markdown' });
        return true;
      },
      handleDOMEvents: {
        copy: (view, event) => {
          const ed = editorRef.current;
          return ed ? copySelectionAsMarkdown(view, event, ed) : false;
        },
        cut: (view, event) => {
          const ed = editorRef.current;
          if (!ed) return false;
          const handled = copySelectionAsMarkdown(view, event, ed);
          if (handled) view.dispatch(view.state.tr.deleteSelection());
          return handled;
        },
      },
    },
  });

  // 实例同步：ref + 通知父组件。
  // cleanup 主动回传 null：切换笔记（sessionKey 变化）时本组件会重挂载，
  // 若不回传，父组件会短暂持有已销毁的 editor 实例并可能在上面执行命令。
  useEffect(() => {
    editorRef.current = editor ?? null;
    onReady?.(editor ?? null);
    return () => {
      onReady?.(null);
    };
  }, [editor, onReady]);

  // 内容变化 → 序列化回传；任意事务 → 通知父组件刷新 UI 状态
  useEffect(() => {
    if (!editor) return;
    const handleTransaction = ({ transaction }: EditorEvents['transaction']) => {
      onTransactionRef.current?.();
      if (transaction.docChanged) {
        const markdown = editor.getMarkdown();
        lastEmittedRef.current = markdown;
        onChangeRef.current(markdown);
      }
    };
    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor]);

  // 外部内容变更（AI 优化结果/重置）→ 重新解析进编辑器（计入撤销历史，Ctrl+Z 可回退）
  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      editor.commands.setContent(value, { contentType: 'markdown' });
    }
  }, [value, editor]);

  // 锁定编辑（AI 优化期间）
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  // 斜杠菜单：点外部 / 滚动时关闭（经 exitSuggestion 通知插件状态）
  useEffect(() => {
    if (!slashState || !editor) return;
    const close = () => {
      exitSuggestion(editor.view, SLASH_MENU_PLUGIN_KEY);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (editor.view.dom.contains(target)) return;
      if (slashMenuElRef.current?.contains(target)) return;
      close();
    };
    // 菜单项多于可视行数时菜单内可滚动，需排除菜单自身的滚动，否则一滚就关、后半部分选不到
    const onScroll = (e: Event) => {
      const target = e.target;
      if (target instanceof Node && slashMenuElRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [slashState, editor]);

  useImperativeHandle(
    ref,
    () => ({
      focus: (position: 'start' | 'end' = 'end') => {
        editorRef.current?.commands.focus(position);
      },
    }),
    [],
  );

  return (
    <div className={`md-editor${editable ? '' : ' is-locked'}`}>
      <EditorContent editor={editor} />
      {slashState && (
        <SlashMenu state={slashState} keydownRef={keydownRef} containerRef={slashMenuElRef} />
      )}
    </div>
  );
}
