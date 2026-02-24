import { useState, useCallback } from 'react';
import type { Toast, ToastType } from '../components/ui/Toast';

let toastIdCounter = 0;

export interface ShowToastOptions {
  type: ToastType;
  message: string;
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(({ type, message, duration }: ShowToastOptions) => {
    const id = `toast-${++toastIdCounter}`;
    const newToast: Toast = { id, type, message, duration };

    setToasts((prev) => [...prev, newToast]);

    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((message: string, duration?: number) => {
    return showToast({ type: 'success', message, duration });
  }, [showToast]);

  const error = useCallback((message: string, duration?: number) => {
    return showToast({ type: 'error', message, duration });
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number) => {
    return showToast({ type: 'warning', message, duration });
  }, [showToast]);

  const info = useCallback((message: string, duration?: number) => {
    return showToast({ type: 'info', message, duration });
  }, [showToast]);

  return {
    toasts,
    showToast,
    dismissToast,
    clearAllToasts,
    success,
    error,
    warning,
    info,
  };
}
