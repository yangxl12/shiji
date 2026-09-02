import type { Editor } from '@tiptap/core';
import './EditorToolbar.css';

interface EditorToolbarProps {
  editor: Editor;
  disabled?: boolean;
}

/** 标题层级循环：正文 → H1 → H2 → H3 → 正文 */
function getHeadingLevel(editor: Editor): number {
  if (editor.isActive('heading', { level: 1 })) return 1;
  if (editor.isActive('heading', { level: 2 })) return 2;
  if (editor.isActive('heading', { level: 3 })) return 3;
  return 0;
}

/**
 * 移动端格式工具条（桌面端由 CSS 隐藏，桌面用快捷键与斜杠菜单）。
 * 横向滚动一条，激活态实时联动光标所在处格式。
 */
export function EditorToolbar({ editor, disabled = false }: EditorToolbarProps) {
  const headingLevel = getHeadingLevel(editor);

  const cycleHeading = () => {
    if (headingLevel === 0) editor.chain().focus().setHeading({ level: 1 }).run();
    else if (headingLevel === 1) editor.chain().focus().setHeading({ level: 2 }).run();
    else if (headingLevel === 2) editor.chain().focus().setHeading({ level: 3 }).run();
    else editor.chain().focus().setParagraph().run();
  };

  const buttons: Array<{
    key: string;
    label: string;
    title: string;
    active: boolean;
    className?: string;
    action: () => void;
  }> = [
    {
      key: 'bold',
      label: 'B',
      title: '加粗',
      active: editor.isActive('bold'),
      className: 'is-bold',
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      label: 'I',
      title: '斜体',
      active: editor.isActive('italic'),
      className: 'is-italic',
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'strike',
      label: 'S',
      title: '删除线',
      active: editor.isActive('strike'),
      className: 'is-strike',
      action: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      key: 'code',
      label: '</>',
      title: '行内代码',
      active: editor.isActive('code'),
      className: 'is-code',
      action: () => editor.chain().focus().toggleCode().run(),
    },
    {
      key: 'heading',
      label: `H${headingLevel || 1}`,
      title: '标题',
      active: headingLevel > 0,
      className: 'is-wide',
      action: cycleHeading,
    },
    {
      key: 'bullet',
      label: '•',
      title: '无序列表',
      active: editor.isActive('bulletList'),
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: 'ordered',
      label: '1.',
      title: '有序列表',
      active: editor.isActive('orderedList'),
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      key: 'task',
      label: '☑',
      title: '任务清单',
      active: editor.isActive('taskList'),
      action: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      key: 'quote',
      label: '❝',
      title: '引用',
      active: editor.isActive('blockquote'),
      action: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      key: 'codeblock',
      label: '{ }',
      title: '代码块',
      active: editor.isActive('codeBlock'),
      action: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      key: 'divider',
      label: '―',
      title: '分割线',
      active: false,
      action: () => editor.chain().focus().setHorizontalRule().run(),
    },
  ];

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="格式工具条">
      {buttons.map((btn) => (
        <button
          key={btn.key}
          type="button"
          className={`editor-toolbar-btn${btn.active ? ' is-active' : ''}${
            btn.className ? ` ${btn.className}` : ''
          }`}
          title={btn.title}
          aria-label={btn.title}
          aria-pressed={btn.active}
          disabled={disabled}
          // 触屏 pointerdown 直接执行，避免虚拟键盘因失焦收起
          onPointerDown={(e) => {
            e.preventDefault();
            btn.action();
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
