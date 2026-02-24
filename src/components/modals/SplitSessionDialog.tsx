import { useState, useCallback, useEffect } from 'react';
import type { Session } from '../../types/electron';

interface SplitSessionDialogProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
  onSplit: (task: string) => Promise<void>;
}

export function SplitSessionDialog({
  session,
  isOpen,
  onClose,
  onSplit,
}: SplitSessionDialogProps) {
  const [task, setTask] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTask('');
      setError(null);
      setIsSplitting(false);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!task.trim()) {
      setError('Please describe the task for the new session');
      return;
    }

    setIsSplitting(true);
    setError(null);

    try {
      await onSplit(task.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to split session');
    } finally {
      setIsSplitting(false);
    }
  }, [task, onSplit, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-strong rounded-xl border border-[var(--border)] animate-fade-in">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Split Session
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Spawn a new Claude session linked to: <span className="text-[var(--accent-primary)]">{session.name || session.project_name}</span>
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div>
              <label
                htmlFor="task"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-2"
              >
                What should the new session work on?
              </label>
              <textarea
                id="task"
                value={task}
                onChange={(e) => {
                  setTask(e.target.value);
                  setError(null);
                }}
                placeholder="Describe the task for the new session..."
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent resize-none"
                rows={3}
                autoFocus
              />
            </div>

            <div className="glass-subtle rounded-lg p-3 text-xs text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)] mb-1">Context Link</p>
              <p>The new session will reference the parent session ID for context continuity.</p>
            </div>

            {error && (
              <div className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSplitting}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSplitting || !task.trim()}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSplitting ? 'Spawning...' : 'Split Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
