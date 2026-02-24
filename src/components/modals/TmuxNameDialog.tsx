import { useState, useCallback, useEffect, useRef } from 'react';

interface TmuxNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  defaultName: string;
}

export function TmuxNameDialog({
  isOpen,
  onClose,
  onConfirm,
  defaultName,
}: TmuxNameDialogProps) {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      // Focus and select input text after render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isOpen, defaultName]);

  const handleConfirm = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
  }, [name, onConfirm]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    },
    [onClose, handleConfirm]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-strong rounded-xl border border-[var(--border)] animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Name Tmux Session
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Choose a name for the new tmux session
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <label
            htmlFor="tmux-name"
            className="block text-sm font-medium text-[var(--text-secondary)] mb-2"
          >
            Session Name
          </label>
          <input
            ref={inputRef}
            id="tmux-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-session"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent font-mono text-sm"
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
