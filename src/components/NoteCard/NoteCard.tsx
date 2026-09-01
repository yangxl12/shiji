import { useRef, useCallback, useEffect } from 'react';
import type { Note, TagColor } from '../../types';
import { TAG_COLORS } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/time';
import './NoteCard.css';

interface NoteCardProps {
  note: Note;
  isBatchMode: boolean;
  isSelected: boolean;
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

  const handleClick = useCallback(() => {
    // 长按已触发，抑制随后的点击（避免误触/重复选中）
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    if (isBatchMode) {
      onToggleSelect();
    } else {
      onClick();
    }
  }, [isBatchMode, onClick, onToggleSelect]);

  // 长按会触发浏览器上下文菜单（桌面右键/移动长按选择），进入多选模式时需屏蔽
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const tagColor = getTagColor(note.tagColor);
  const displayTitle = note.title || note.content.slice(0, 20);
  const isPlaceholderTitle = !note.title && note.content;

  return (
    <div className="note-card-wrapper">
      {/* Card Content */}
      <div
        className={`note-card ${isBatchMode ? 'note-card-batch' : ''}`}
        onClick={handleClick}
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
          <div
            className={`note-card-title ${
              isPlaceholderTitle ? 'note-card-placeholder-title' : ''
            }`}
          >
            {displayTitle}
          </div>
          {tagColor && !isBatchMode && (
            <div
              className="note-card-tag"
              style={{ backgroundColor: tagColor }}
            />
          )}
        </div>
        {note.title && note.content && (
          <div className="note-card-content">{note.content}</div>
        )}
        <div className="note-card-time">{formatRelativeTime(note.updatedAt)}</div>
      </div>
    </div>
  );
}
