import './BatchActionBar.css';

interface BatchActionBarProps {
  selectedCount: number;
  totalCount: number;
  onCancel: () => void;
  onSelectAll: () => void;
  onDelete: () => void;
}

export function BatchActionBar({
  selectedCount,
  totalCount,
  onCancel,
  onSelectAll,
  onDelete,
}: BatchActionBarProps) {
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="batch-action-bar">
      <div className="batch-action-left">
        <button className="batch-action-cancel" onClick={onCancel}>
          取消
        </button>
        <span className="batch-action-count">
          已选择 {selectedCount} 条
        </span>
      </div>
      <div className="batch-action-right">
        <button
          className="batch-action-btn batch-action-select-all"
          onClick={onSelectAll}
          disabled={totalCount === 0}
        >
          {isAllSelected ? '取消全选' : '全选'}
        </button>
        <button
          className="batch-action-btn batch-action-delete"
          onClick={onDelete}
          disabled={selectedCount === 0}
        >
          删除
        </button>
      </div>
    </div>
  );
}
