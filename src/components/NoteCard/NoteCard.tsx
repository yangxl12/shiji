import { useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { Note, TagColor } from '../../types';
import { TAG_COLORS } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/time';
import { markdownToPlainText, renderMarkdownHtml } from '../../utils/markdown';
import './NoteCard.css';

interface NoteCardProps {
  note: Note;
  isBatchMode: boolean;
  isSelected: boolean;
  /** 首屏入场编排索引（前 8 张 28ms 递进，由列表页传入；纯展示用） */
  index?: number;
  onClick: () => void;
  onToggleSelect: () => void;
  onLongPress: () => void;
}

const getTagColor = (tagColor: TagColor | null): string | null => {
  if (!tagColor) return null;
  const color = TAG_COLORS.find((c) => c.key === tagColor);
  return color?.value ?? null;
};

export function NoteCard({
  note,
  isBatchMode,
  isSelected,
  index,
  onClick,
  onToggleSelect,
  onLongPress,
}: NoteCardProps) {
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const LONG_PRESS_DURATION = 500;
  const LONG_PRESS_TOLERANCE = 10; // 超过该位移视为滑动/滚动，取消长按

  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // 组件卸载时清理定时器
  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (isBatchMode) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartXRef.current = clientX;
    touchStartYRef.current = clientY;

    // 开始长按计时
    longPressFiredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      onLongPress();
    }, LONG_PRESS_DURATION);
  }, [isBatchMode, clearLongPressTimer, onLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - touchStartXRef.current;
    const deltaY = clientY - touchStartYRef.current;

    // 手指移动超过容差（滑动/滚动意图），取消长按
    if (
      longPressTimerRef.current !== null &&
      (Math.abs(deltaX) > LONG_PRESS_TOLERANCE || Math.abs(deltaY) > LONG_PRESS_TOLERANCE)
    ) {
      clearLongPressTimer();
    }
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  // 长按会触发浏览器上下文菜单（桌面右键/移动长按选择），进入多选模式时需屏蔽
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ── 卡内快速展开 / 收起（手风琴）：高度动画走命令式 style，React 状态只管视觉 ──
  const [expanded, setExpanded] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const collapsedHeightRef = useRef(0);
  const animDirRef = useRef<'expand' | 'collapse' | null>(null);
  const reduceMotion = useRef(
    typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  /** 逻辑展开态（aria / 按钮语义）；批量模式下强制视为收起 */
  const isOpen = expanded && !isBatchMode;
  /** 视觉展开态：解除两行截断并渲染「收起」按钮；收起动画期间保持 true，避免内容先跳变为截断态 */
  const showOpen = (expanded || collapsing) && !isBatchMode;

  // 按钮交互不应触发卡片长按（多选）与点击（进入编辑）
  const stopEventPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const toggleExpand = useCallback(() => {
    if (isBatchMode) return;
    const body = bodyRef.current;

    // 减动效偏好：跳过高度动画，直接切换
    if (reduceMotion.current || !body) {
      animDirRef.current = null;
      setCollapsing(false);
      setExpanded((v) => !v);
      return;
    }

    if (expanded) {
      // 收起：冻结当前渲染高度，下一帧过渡回收纳高度
      body.style.height = `${body.clientHeight}px`;
      animDirRef.current = 'collapse';
      setExpanded(false);
      setCollapsing(true);
    } else {
      // 展开：冻结当前高度作为动画起点；仅在静止时更新收纳基准（避免快速连点覆盖基准值）
      if (animDirRef.current === null) {
        collapsedHeightRef.current = body.clientHeight;
      }
      body.style.height = `${body.clientHeight}px`;
      animDirRef.current = 'expand';
      setCollapsing(false);
      setExpanded(true);
    }
  }, [expanded, isBatchMode]);

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpand();
  }, [toggleExpand]);

  // 卡片级点击（标题行/时间/空白区域）：批量模式切换选中；普通模式展开/收起
  const handleCardClick = useCallback(() => {
    // 长按已触发，抑制随后的点击（避免误触/重复选中）
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    if (isBatchMode) {
      onToggleSelect();
    } else {
      toggleExpand();
    }
  }, [isBatchMode, onToggleSelect, toggleExpand]);

  // 内容区点击：进入笔记详情（批量模式下冒泡给卡片级处理选中）
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    if (isBatchMode) return;
    e.stopPropagation();
    onClick();
  }, [isBatchMode, onClick]);

  // DOM 提交后再测目标高度并启动过渡（强制 reflow 让起始高度先生效，否则会被合并成一次跳变）；
  // 批量模式下清掉动画残留的内联高度
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (isBatchMode) {
      animDirRef.current = null;
      body.style.removeProperty('height');
      return;
    }
    if (!animDirRef.current) return;
    void body.offsetHeight;
    const target =
      animDirRef.current === 'expand' ? body.scrollHeight : collapsedHeightRef.current;
    body.style.height = `${target}px`;
  }, [expanded, collapsing, isBatchMode]);

  // 过渡结束：展开回 auto（自适应后续内容/主题变化），收起移除内联高度恢复截断态
  const handleBodyTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      const body = bodyRef.current;
      if (e.target !== body || e.propertyName !== 'height' || !animDirRef.current) return;
      animDirRef.current = null;
      if (expanded) {
        body.style.height = 'auto';
      } else {
        body.style.removeProperty('height');
        setCollapsing(false);
      }
    },
    [expanded]
  );

  // 进入批量模式时重置展开态（渲染期 prop 适配写法，避免 effect 级联渲染）
  const [wasBatchMode, setWasBatchMode] = useState(isBatchMode);
  if (wasBatchMode !== isBatchMode) {
    setWasBatchMode(isBatchMode);
    if (isBatchMode) {
      setExpanded(false);
      setCollapsing(false);
    }
  }

  const tagColor = getTagColor(note.tagColor);
  // 卡片预览用纯文本：剥离 Markdown 语法，仅作展示
  const plainContent = useMemo(() => markdownToPlainText(note.content), [note.content]);
  // 展开态的 Markdown 预览 HTML：懒渲染（仅 showOpen 时解析，收起态保持纯文本，列表滚动零开销）
  const mdHtml = useMemo(
    () => (showOpen ? renderMarkdownHtml(note.content) : ''),
    [showOpen, note.content]
  );
  const displayTitle = note.title || plainContent.slice(0, 20);
  const isPlaceholderTitle = !note.title && !!note.content;

  // 纯展示用 CSS 变量：--tag-c 标签色（色点及光环）、--i 首屏编排索引（前 8 张）
  const cardStyle = {
    ...(tagColor ? { '--tag-c': tagColor } : {}),
    ...(index !== undefined && index < 8 ? { '--i': index } : {}),
  } as React.CSSProperties;

  return (
    <div className="note-card-wrapper">
      {/* Card Content */}
      <div
        className={`note-card ${isBatchMode ? 'note-card-batch' : ''} ${
          showOpen ? 'note-card-open' : ''
        }`}
        style={cardStyle}
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        {isBatchMode && (
          <div
            className={`note-card-checkbox ${
              isSelected ? 'note-card-checkbox-checked' : ''
            }`}
          >
            {isSelected && (
              <svg viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            )}
          </div>
        )}
        <div className="note-card-header">
          {!isBatchMode && (
            <button
              type="button"
              className="note-card-toggle"
              aria-expanded={isOpen}
              aria-label={isOpen ? '收起笔记' : '展开笔记'}
              onClick={handleToggleExpand}
              onMouseDown={stopEventPropagation}
              onTouchStart={stopEventPropagation}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 9.5l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <div
            className={`note-card-title ${
              isPlaceholderTitle ? 'note-card-placeholder-title' : ''
            }`}
          >
            {displayTitle}
          </div>
          {tagColor && !isBatchMode && (
            <div className="note-card-tag" />
          )}
        </div>
        {/* 高度过渡容器：收起时裁剪为两行，展开时随内容向下拉伸 */}
        <div
          className="note-card-body"
          ref={bodyRef}
          onTransitionEnd={handleBodyTransitionEnd}
        >
          {note.content && (note.title || showOpen) && (
            showOpen ? (
              // 展开态：Markdown 预览（HTML 已在 renderMarkdownHtml 内 sanitize）
              <div
                className="note-card-content note-card-content-md"
                onClick={handleContentClick}
                dangerouslySetInnerHTML={{ __html: mdHtml }}
              />
            ) : (
              // 收起态：纯文本两行截断
              <div className="note-card-content" onClick={handleContentClick}>
                {plainContent}
              </div>
            )
          )}
          {showOpen && (
            <div className="note-card-collapse-footer">
              <button
                type="button"
                className="note-card-collapse-btn"
                onClick={handleToggleExpand}
                onMouseDown={stopEventPropagation}
                onTouchStart={stopEventPropagation}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M18 15l-6-6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                收起
              </button>
            </div>
          )}
        </div>
        <div className="note-card-time">{formatRelativeTime(note.updatedAt)}</div>
      </div>
    </div>
  );
}
