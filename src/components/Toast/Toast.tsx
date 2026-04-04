import { useEffect, useState } from 'react';
import type { ToastMessage } from '../../types';
import './Toast.css';

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

export function Toast({ message, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onClose(message.id);
      }, 200);
    }, message.duration ?? 2000);

    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className={`toast ${isExiting ? 'toast-exit' : ''}`}>
      {message.message}
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      <Toast message={toasts[toasts.length - 1]} onClose={onClose} />
    </div>
  );
}
