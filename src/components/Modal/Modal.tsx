import './Modal.css';

export interface ModalProps {
  isOpen: boolean;
  title: string;
  content: string;
  cancelText?: string;
  confirmText?: string;
  isDanger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function Modal({
  isOpen,
  title,
  content,
  cancelText = '取消',
  confirmText = '确认',
  isDanger = false,
  onCancel,
  onConfirm,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-content">{content}</p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`modal-btn ${isDanger ? 'modal-btn-danger' : 'modal-btn-confirm'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
