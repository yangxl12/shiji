import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import type { EditorState } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionProps } from '@tiptap/suggestion';
import { filterSlashItems, type SlashMenuItem } from './slashMenuItems';
import type { SlashKeydownBridge } from './SlashMenu';

/** 斜杠菜单对 React 侧暴露的状态（clientRect 为 '/' 字符的视口坐标回调） */
export interface SlashMenuState {
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
  clientRect?: (() => DOMRect | null) | null;
}

interface CreateSlashMenuOptions {
  pluginKey: PluginKey;
  /** React 菜单组件注册的键盘处理（↑↓/Enter），由 suggestion 在编辑器 keydown 时调用 */
  keydownRef: SlashKeydownBridge;
  onStateChange: (state: SlashMenuState | null) => void;
}

function toState(props: SuggestionProps): SlashMenuState {
  return {
    items: props.items as SlashMenuItem[],
    command: (item) => props.command(item),
    clientRect: props.clientRect,
  };
}

/**
 * 触发位置判定。
 * suggestion 默认要求 '/' 位于行首或空格之后（allowedPrefixes: [' ']），
 * 这里放宽到任意位置（含文字中间），但排除明显属于 URL / 文件路径的 '/'。
 */
function isSlashAllowed({ state, range }: { state: EditorState; range: { from: number; to: number } }) {
  const $from = state.doc.resolve(range.from);
  // 代码块内 '/' 是代码内容
  if ($from.parent.type.spec.code) return false;
  // 已被自动识别为链接的文本内部（如 https://a.com/x）不打断
  if ($from.marks().some((mark) => mark.type.name === 'link')) return false;
  // '//'、':' 后的 '/'、Windows 路径分隔符都属于 URL / 路径
  const textBefore = state.doc.textBetween($from.start(), range.from, '\n', '\uFFFC');
  const charBefore = textBefore.slice(-1);
  if (charBefore === '/' || charBefore === ':' || charBefore === '\\') return false;
  // 正在输入 URL（http://…、www.…）时，其中的 '/' 是链接内容
  return !/(?:https?:\/\/|www\.)\S*$/i.test(textBefore);
}

/** 创建「/ 斜杠命令」扩展：输入 / 弹出块插入面板（Notion 风格） */
export function createSlashMenuExtension({
  pluginKey,
  keydownRef,
  onStateChange,
}: CreateSlashMenuOptions) {
  return Extension.create({
    name: 'slashMenu',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          pluginKey,
          char: '/',
          // null：不做前缀限制，改由 allow 判断触发位置
          allowedPrefixes: null,
          allow: isSlashAllowed,
          command: ({ editor, range, props }) => {
            props.command({ editor, range });
          },
          items: ({ query }) => filterSlashItems(query),
          render: () => ({
            onStart: (props) => onStateChange(toState(props)),
            onUpdate: (props) => onStateChange(toState(props)),
            onExit: () => onStateChange(null),
            onKeyDown: ({ event }) => keydownRef.current?.(event) ?? false,
          }),
        }),
      ];
    },
  });
}
