import { useFabAutoHide } from '../../hooks/useFabAutoHide';
import './FAB.css';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  const hidden = useFabAutoHide();

  return (
    <button
      className={`fab${hidden ? ' fab-hidden' : ''}`}
      onClick={onClick}
      aria-label="新建笔记"
    >
      <div className="fab-icon">
        {/* 经典钢笔：笔杆 45° 斜置 + 笔尖分叉，实心填充与墨色晶体底相衬 */}
        <svg viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
          <path d="M20.71 4.04l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41z" />
        </svg>
      </div>
    </button>
  );
}
