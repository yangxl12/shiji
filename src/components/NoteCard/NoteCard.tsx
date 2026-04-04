import { useRef, useCallback } from 'react';
import type { Note, TagColor } from '../../types';
import { TAG_COLORS } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/time';
import './NoteCard.css';

interface NoteCardProps {
  note: Note;
  isBatchMode: boolean;
  isSelected: boolean;
  onClick: () => void;
  onLongPress: () => void;
  onToggleSelect: () => void;
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
  onLongPress,
  onToggleSelect,
}: NoteCardProps) {
  const timerRef = useRef<number | null>(null);
  const isLongPressRef = useRef(false);

  const handleTouchStart = useCallback(() => {
    isLongPressRef.current = false;
    timerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, 300);
  }, [onLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (isLongPressRef.current) return;

    if (isBatchMode) {
      onToggleSelect();
    } else {
      onClick();
    }
  }, [isBatchMode, isSelected, onClick, onToggleSelect]);

  const tagColor = getTagColor(note.tagColor);
  const displayTitle = note.title || note.content.slice(0, 20);
  const isPlaceholderTitle = !note.title && note.content;

  return (
    <div
      className={`note-card ${isBatchMode ? 'note-card-batch' : ''}`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
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
  );
}
