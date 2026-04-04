import type { TagColor } from '../../types';
import { TAG_COLORS } from '../../utils/constants';
import './TagSelector.css';

interface TagSelectorProps {
  selectedTag: TagColor | null;
  onChange: (tag: TagColor | null) => void;
}

export function TagSelector({ selectedTag, onChange }: TagSelectorProps) {
  const handleClick = (tagKey: TagColor) => {
    if (selectedTag === tagKey) {
      onChange(null);
    } else {
      onChange(tagKey);
    }
  };

  return (
    <div className="tag-selector">
      {TAG_COLORS.map((tag) => (
        <div
          key={tag.key}
          className={`tag-option ${
            selectedTag === tag.key ? 'tag-option-selected' : ''
          }`}
          style={{
            backgroundColor: tag.value,
            color: tag.value,
          }}
          onClick={() => handleClick(tag.key)}
          title={tag.label}
        />
      ))}
    </div>
  );
}
