import type { TagColor } from '../../types';
import { TAG_COLORS } from '../../utils/constants';
import './TagChipNav.css';

interface TagChipNavProps {
  selectedTag: TagColor | 'all';
  onSelect: (tag: TagColor | 'all') => void;
}

/** 「全部」图标：四色田字格，对应四种标签色 */
const AllIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="8" height="8" rx="2.5" style={{ fill: 'var(--tag-red)' }} />
    <rect x="13" y="3" width="8" height="8" rx="2.5" style={{ fill: 'var(--tag-orange)' }} />
    <rect x="3" y="13" width="8" height="8" rx="2.5" style={{ fill: 'var(--tag-yellow)' }} />
    <rect x="13" y="13" width="8" height="8" rx="2.5" style={{ fill: 'var(--tag-gray)' }} />
  </svg>
);

/** 单色标签图标：经典 tag 造型，以标签色填充 */
const TagIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      style={{ fill: color }}
      d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"
    />
  </svg>
);

export function TagChipNav({ selectedTag, onSelect }: TagChipNavProps) {
  return (
    <div className="tag-chip-nav" role="group" aria-label="按标签筛选">
      <button
        type="button"
        className={`tag-chip${selectedTag === 'all' ? ' tag-chip-selected tag-chip-all' : ''}`}
        onClick={() => onSelect('all')}
        title="全部"
        aria-label="全部笔记"
        aria-pressed={selectedTag === 'all'}
      >
        <AllIcon />
      </button>
      {TAG_COLORS.map((tag) => {
        const isSelected = selectedTag === tag.key;
        return (
          <button
            key={tag.key}
            type="button"
            className={`tag-chip${isSelected ? ` tag-chip-selected tag-chip-${tag.key}` : ''}`}
            onClick={() => onSelect(isSelected ? 'all' : tag.key)}
            title={`${tag.label}色标签`}
            aria-label={`${tag.label}色标签`}
            aria-pressed={isSelected}
          >
            <TagIcon color={tag.value} />
          </button>
        );
      })}
    </div>
  );
}
