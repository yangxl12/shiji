import { memo, useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { Note, TagColor } from '../../types';
import { TAG_COLORS } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/time';
import { markdownToPlainText, renderMarkdownHtml, prewarmMarkdownHtml } from '../../utils/markdown';
import './NoteCard.css';

interface NoteCardProps {
  note: Note;
  isBatchMode: boolean;
  isSelected: boolean;
  /** 首屏入场编排索引（前 8 张 28ms 递进，由列表页传入；纯展示用） */
  index: number;
  /** 打开笔记详情（引用稳定，配合 memo 避免无关重渲染） */
  onOpen: (note: Note) => void;
  onToggleSelect: (id: string) => void;
  onLongPress: (id: string) => void;
}

const getTagColor = (tagColor: TagColor | null): string | null => {
  if (!tagColor) return null;
  const color = TAG_COLORS.find((c) => c.key === tagColor);
  return color?.value ?? null;
};

/** 展开 / 收起时长：比通用过渡更短，减少高度动画期间的逐帧重排帧数 */
const EXPAND_DURATION = 240;
const COLLAPSE_DURATION = 190;
/** 展开先快后缓（内容到达），收起先缓后快（内容让路） */
const EXPAND_EASING = 'cubic-bezier(0.05, 0.7, 0.1, 1)';
const COLLAPSE_EASING = 'cubic-bezier(0.3, 0, 0.8, 0.15)';

const LONG_PRESS_DURATION = 500;
const LONG_PRESS_TOLERANCE = 10; // 超过该位移视为滑动/滚动，取消长按

export const NoteCard = memo(function NoteCard({
  note,
  isBatchMode,
  isSelected,
  index,
  onOpen,
  onToggleSelect,
  onLongPress,
}: NoteCardProps) {
  // 绑定本卡片引用：memo 下父级回调保持稳定，这里只在 note/id 变化时重绑
  const handleOpen = useCallback(() => onOpen(note), [onOpen, note]);
  const handleToggleSelect = useCallback(() => onToggleSelect(note.id), [onToggleSelect, note.id]);
  const handleLongPress = useCallback(() => onLongPress(note.id), [onLongPress, note.id]);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
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
      handleLongPress();
    }, LONG_PRESS_DURATION);
  }, [isBatchMode, clearLongPressTimer, handleLongPress]);

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

  // ── 卡内快速展开 / 收起（手风琴）──
  // 高度动画走 Web Animations API：点击时读一次起始高度，DOM 提交后测一次目标高度，
  // 全程只有一次必要的同步布局；动画期间浏览器不再触发 transition 的逐帧样式重算。
  const [expanded, setExpanded] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const collapsedHeightRef = useRef(0);
  const pendingRef = useRef<{ dir: 'expand' | 'collapse'; from: number } | null>(null);
  const animRef = useRef<Animation | null>(null);
  const reduceMotionRef = useRef(
    typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  /** 逻辑展开态（aria / 按钮语义）；批量模式下同样保持，长按进入多选不会收起已展开的笔记 */
  const isOpen = expanded;
  /** 视觉展开态：解除两行截断并渲染「收起」按钮；收起动画期间保持 true，避免内容先跳变为截断态 */
  const showOpen = expanded || collapsing;

  // 按钮交互不应触发卡片长按（多选）与点击（进入编辑）
  const stopEventPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  /** 动画结束收尾：展开交还 auto（自适应后续内容/主题变化），收起移除内联高度恢复截断态 */
  const settle = useCallback((dir: 'expand' | 'collapse') => {
    const body = bodyRef.current;
    if (dir === 'expand') {
      if (body) body.style.height = 'auto';
    } else {
      if (body) body.style.removeProperty('height');
      setCollapsing(false);
    }
  }, []);

  const stopAnimation = useCallback(() => {
    const anim = animRef.current;
    animRef.current = null;
    if (anim) {
      anim.onfinish = null;
      anim.oncancel = null;
      anim.cancel();
    }
  }, []);

  const toggleExpand = useCallback(() => {
    const body = bodyRef.current;

    if (!body || reduceMotionRef.current) {
      stopAnimation();
      body?.style.removeProperty('height');
      setCollapsing(false);
      setExpanded((v) => !v);
      return;
    }

    // 动画进行中时以当前高度为新起点（连点不跳变）；静止时顺带刷新收起基准高度
    const running = animRef.current !== null;
    const from = body.clientHeight;
    if (!running && !expanded) collapsedHeightRef.current = from;
    stopAnimation();

    if (expanded) {
      pendingRef.current = { dir: 'collapse', from };
      setExpanded(false);
      setCollapsing(true);
    } else {
      pendingRef.current = { dir: 'expand', from };
      setCollapsing(false);
      setExpanded(true);
    }
  }, [expanded, stopAnimation]);

  useEffect(() => stopAnimation, [stopAnimation]);

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
      handleToggleSelect();
    } else {
      toggleExpand();
    }
  }, [isBatchMode, handleToggleSelect, toggleExpand]);

  // 内容区点击：进入笔记详情（批量模式下冒泡给卡片级处理选中）
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    if (isBatchMode) return;
    e.stopPropagation();
    handleOpen();
  }, [isBatchMode, handleOpen]);

  // DOM 提交后测目标高度并启动动画（此时布局本就要重算，测量不再产生额外开销）
  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;

    const body = bodyRef.current;
    if (!body) return;

    const { dir, from } = pending;
    const to = dir === 'expand' ? body.scrollHeight : collapsedHeightRef.current;

    // 高度无变化或环境不支持 WAAPI：直接落到终态
    if (Math.abs(to - from) < 1 || typeof body.animate !== 'function') {
      settle(dir);
      return;
    }

    const anim = body.animate(
      [{ height: `${from}px` }, { height: `${to}px` }],
      {
        duration: dir === 'expand' ? EXPAND_DURATION : COLLAPSE_DURATION,
        easing: dir === 'expand' ? EXPAND_EASING : COLLAPSE_EASING,
        fill: 'forwards',
      }
    );
    animRef.current = anim;

    const finish = () => {
      if (animRef.current !== anim) return; // 已被新的切换接管
      animRef.current = null;
      anim.onfinish = null;
      anim.oncancel = null;
      // 先撤掉 fill 效果再落内联样式，避免中间帧闪回
      anim.cancel();
      settle(dir);
    };
    anim.onfinish = finish;
    anim.oncancel = () => {
      if (animRef.current === anim) animRef.current = null;
    };
  });

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

  // 空闲时预渲染本卡片的 HTML，首次点击展开即可命中缓存
  useEffect(() => {
    prewarmMarkdownHtml(note.content);
  }, [note.content]);

  // 纯展示用 CSS 变量：--tag-c 标签色（色点及光环）、--i 首屏编排索引（前 8 张）
  const isEnter = index < 8;
  const cardStyle = useMemo(() => {
    const style: Record<string, string | number> = {};
    if (tagColor) style['--tag-c'] = tagColor;
    if (isEnter) style['--i'] = index;
    return style as React.CSSProperties;
  }, [tagColor, isEnter, index]);

  return (
    <div className="note-card-wrapper">
      {/* Card Content */}
      <div
        className={`note-card ${isBatchMode ? 'note-card-batch' : ''} ${
          showOpen ? 'note-card-open' : ''
        }${isEnter ? ' note-card-enter' : ''}`}
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
          {/* 展开/收起按钮：批量模式下同样保留，长按进入多选后仍可继续展开查看 */}
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
        {/* 高度动画容器：收起时裁剪为两行，展开时随内容向下拉伸 */}
        <div className="note-card-body" ref={bodyRef}>
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
});
