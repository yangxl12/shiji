import './FAB.css';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  return (
    <button className="fab" onClick={onClick} aria-label="新建笔记">
      <div className="fab-icon">
        <svg viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </div>
    </button>
  );
}
