import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Ledger } from '../../types/electron';
import { MARKDOWN_COMPONENTS } from '../shared/markdownComponents';

interface LedgerViewerProps {
  ledger: Ledger | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (ledger: Ledger) => void;
  onResume: (ledger: Ledger) => void;
}

export function LedgerViewer({
  ledger,
  isOpen,
  onClose,
  onEdit,
  onResume,
}: LedgerViewerProps) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && ledger) {
      loadContent();
    }
  }, [isOpen, ledger?.path]);

  const loadContent = async () => {
    if (!ledger) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.readLedger(ledger.path);
      setContent(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ledger');
    } finally {
      setIsLoading(false);
    }
  };

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

  if (!isOpen || !ledger) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[90vw] max-w-4xl h-[85vh] glass-strong rounded-xl border border-[var(--border)] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-[var(--purple)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {ledger.name}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {ledger.projectPath.split('/').pop()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onResume(ledger)}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-colors duration-200"
            >
              Resume Session
            </button>
            <button
              onClick={() => onEdit(ledger)}
              className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Edit
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <svg
                className="w-5 h-5 text-[var(--text-secondary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-[var(--danger)] mb-2">Failed to load ledger</p>
                <p className="text-sm text-[var(--text-secondary)]">{error}</p>
                <button
                  onClick={loadContent}
                  className="mt-4 px-4 py-2 bg-[var(--bg-tertiary)] rounded-lg text-sm hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none ledger-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={MARKDOWN_COMPONENTS}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border)] bg-[var(--bg-tertiary)]/50">
          <div className="text-xs text-[var(--text-muted)]">
            Last modified: {new Date(ledger.lastModified).toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {ledger.path}
          </div>
        </div>
      </div>
    </div>
  );
}
