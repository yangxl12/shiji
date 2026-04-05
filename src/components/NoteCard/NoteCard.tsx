import { useRef, useCallback, useState, useEffect } from 'react';
import type { Note, TagColor } from '../../types';
import { TAG_COLORS } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/time';
import './NoteCard.css';

interface NoteCardProps {
  note: Note;
  isBatchMode: boolean;
  isSelected: boolean;
  isSwiped: boolean;
  onClick: () => void;
  onToggleSelect: () => void;
  onSwipe: (isSwiped: boolean) => void;
  onDelete: () => void;
}

const getTagColor = (tagColor: TagColor | null): string | null => {
  if (!tagColor) return null;
  const color = TAG_COLORS.find((c) => c.key === tagColor);
  return color?.value ?? null;
};

// Delete icon SVG
const DeleteIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

// Cancel icon SVG
const CancelIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

export function NoteCard({
  note,
  isBatchMode,
  isSelected,
  isSwiped,
  onClick,
  onToggleSelect,
  onSwipe,
  onDelete,
}: NoteCardProps) {
  const [currentOffset, setCurrentOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartXRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 60;
  const MAX_SWIPE = 144; // 72px * 2 buttons
  const ACTION_WIDTH = 144;

  // Reset offset when swiped state changes externally
  useEffect(() => {
    if (!isSwiped) {
      setCurrentOffset(0);
    }
  }, [isSwiped]);

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (isBatchMode) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    touchStartXRef.current = clientX;
    touchStartTimeRef.current = Date.now();
    setIsDragging(true);
  }, [isBatchMode]);

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || isBatchMode) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - touchStartXRef.current;

    // Only allow left swipe (negative deltaX)
    if (deltaX < 0) {
      const absOffset = Math.min(Math.abs(deltaX), MAX_SWIPE);
      setCurrentOffset(-absOffset);
    } else if (deltaX > 0 && isSwiped) {
      // Swiping right to close
      setCurrentOffset(Math.max(-ACTION_WIDTH + deltaX, 0));
    }
  }, [isDragging, isBatchMode, isSwiped]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const absOffset = Math.abs(currentOffset);
    const timeDelta = Date.now() - touchStartTimeRef.current;
    const velocity = absOffset / timeDelta;

    // Fast swipe or past threshold -> open, otherwise close
    if (velocity > 0.5 || absOffset > SWIPE_THRESHOLD) {
      setCurrentOffset(-ACTION_WIDTH);
      onSwipe(true);
    } else {
      setCurrentOffset(0);
      onSwipe(false);
    }
  }, [isDragging, currentOffset, onSwipe]);

  const handleClick = useCallback(() => {
    if (isDragging) return;

    if (isBatchMode) {
      onToggleSelect();
    } else if (isSwiped) {
      // Close if swiped
      onSwipe(false);
    } else {
      onClick();
    }
  }, [isBatchMode, isSwiped, isDragging, onClick, onToggleSelect, onSwipe]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  }, [onDelete]);

  const handleCancelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSwipe(false);
  }, [onSwipe]);

  const tagColor = getTagColor(note.tagColor);
  const displayTitle = note.title || note.content.slice(0, 20);
  const isPlaceholderTitle = !note.title && note.content;

  return (
    <div className="note-card-wrapper">
      {/* Swipe Actions Background */}
      {!isBatchMode && (
        <div className="note-card-actions">
          <button
            className="note-card-action-btn note-card-action-delete"
            onClick={handleDeleteClick}
          >
            <DeleteIcon />
            <span>删除</span>
          </button>
          <button
            className="note-card-action-btn note-card-action-cancel"
            onClick={handleCancelClick}
          >
            <CancelIcon />
            <span>取消</span>
          </button>
        </div>
      )}

      {/* Card Content */}
      <div
        ref={cardRef}
        className={`note-card ${isBatchMode ? 'note-card-batch' : ''}`}
        style={{
          transform: `translateX(${currentOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
        onClick={handleClick}
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
          {tagColor && !isBatchMode && !isSwiped && (
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
