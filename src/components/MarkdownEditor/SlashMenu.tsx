import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SlashMenuState } from './slashMenuExtension';

/** ProseMirror 插件 → React 菜单的键盘桥容器 */
export interface SlashKeydownBridge {
  current: ((event: KeyboardEvent) => boolean) | null;
}

interface SlashMenuProps {
  state: SlashMenuState;
  /** 注册键盘处理（suggestion 转发编辑器 keydown），返回 true 表示已消费 */
  keydownRef: SlashKeydownBridge;
  /** 菜单根节点 ref（供外层判断点击是否在菜单内） */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const MENU_WIDTH = 216;
const MAX_VISIBLE_ITEMS = 7;

/** 「/ 斜杠命令」弹层：跟随 '/' 字符定位，支持 ↑↓ 选择、Enter 确认、点击插入 */
export function SlashMenu({ state, keydownRef, containerRef }: SlashMenuProps) {
  const items = state.items;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevState, setPrevState] = useState(state);
  const listRef = useRef<HTMLDivElement>(null);

  // 查询词变化（state 引用更新）时重置选中项（渲染期状态调整，React 官方模式）
  if (prevState !== state) {
    setPrevState(state);
    setSelectedIndex(0);
  }

  // 选中项滚动进可视区
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const runCommand = useCallback(
    (itemIndex: number) => {
      const item = items[itemIndex];
      if (item) state.command(item);
    },
    [items, state],
  );

  // 键盘导航注册给 suggestion（编辑器 keydown 先于默认行为到达这里）
  useEffect(() => {
    const handler = (event: KeyboardEvent): boolean => {
      if (items.length === 0) return false;
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        runCommand(selectedIndex);
        return true;
      }
      return false;
    };
    keydownRef.current = handler;
    return () => {
      if (keydownRef.current === handler) keydownRef.current = null;
    };
  }, [items, selectedIndex, runCommand, keydownRef]);

  if (items.length === 0) return null;

  // 定位：菜单落在 '/' 下方；超出视口右缘左移、超出底缘改到上方
  const rect = state.clientRect?.() ?? null;
  const estimatedHeight = Math.min(items.length, MAX_VISIBLE_ITEMS) * 46 + 12;
  let left = 16;
  let top = 0;
  if (rect) {
    left = Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH - 8);
    top = rect.bottom + 8;
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - estimatedHeight - 8);
    }
  }

  return createPortal(
    <div
      className="slash-menu"
      style={{ left, top, width: MENU_WIDTH }}
      ref={containerRef}
      role="menu"
      aria-label="插入块"
    >
      <div className="slash-menu-list" ref={listRef}>
        {items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className="slash-menu-item"
            data-selected={index === selectedIndex}
            role="menuitem"
            // pointerdown 阻止默认行为，避免点击前编辑器失焦/选区被清
            onPointerDown={(e) => {
              e.preventDefault();
              runCommand(index);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="slash-menu-icon">{item.icon}</span>
            <span className="slash-menu-text">
              <span className="slash-menu-title">{item.title}</span>
              <span className="slash-menu-hint">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
