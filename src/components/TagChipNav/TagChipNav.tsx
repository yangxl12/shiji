import type { TagColor } from '../../types';
import { TAG_COLORS } from '../../utils/constants';
import './TagChipNav.css';

interface TagChipNavProps {
  selectedTag: TagColor | 'all';
  onSelect: (tag: TagColor | 'all') => void;
}

export function TagChipNav({ selectedTag, onSelect }: TagChipNavProps) {
  return (
    <div className="tag-chip-nav">
      <div
        className={`tag-chip ${
          selectedTag === 'all' ? 'tag-chip-selected tag-chip-all' : ''
        }`}
        onClick={() => onSelect('all')}
      >
        <div className="tag-chip-dot tag-chip-dot-all" />
        <span>全部</span>
      </div>
      {TAG_COLORS.map((tag) => (
        <div
          key={tag.key}
          className={`tag-chip ${
            selectedTag === tag.key ? `tag-chip-selected tag-chip-${tag.key}` : ''
          }`}
          onClick={() =>
            onSelect(selectedTag === tag.key ? 'all' : tag.key)
          }
        >
          <div
            className="tag-chip-dot"
            style={{ backgroundColor: tag.value }}
          />
          <span>{tag.label}</span>
        </div>
      ))}
    </div>
  );
}
