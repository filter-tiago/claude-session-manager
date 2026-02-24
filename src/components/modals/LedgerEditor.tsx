import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Ledger } from '../../types/electron';
import { MARKDOWN_COMPONENTS } from '../shared/markdownComponents';

interface LedgerEditorProps {
  ledger: Ledger | null;
  initialContent: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

export function LedgerEditor({
  ledger,
  initialContent,
  isOpen,
  onClose,
  onSave,
}: LedgerEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Reset content when ledger changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setHasUnsavedChanges(false);
      setError(null);
    }
  }, [isOpen, initialContent]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(content !== initialContent);
  }, [content, initialContent]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onSave(content);
      setHasUnsavedChanges(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave, onClose]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [handleClose, handleSave]);

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
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-[95vw] max-w-6xl h-[90vh] glass-strong rounded-xl border border-[var(--border)] flex flex-col animate-fade-in">
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Edit: {ledger.name}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {hasUnsavedChanges && (
                  <span className="text-[var(--warning)]">● Unsaved changes</span>
                )}
                {!hasUnsavedChanges && 'No changes'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {error && (
              <span className="text-sm text-[var(--danger)] mr-2">{error}</span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Panel */}
          <div className="w-1/2 flex flex-col border-r border-[var(--border)]">
            <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-tertiary)]/50">
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Editor
              </span>
            </div>
            <textarea
              value={content}
              onChange={handleContentChange}
              className="flex-1 p-4 bg-transparent text-[var(--text-primary)] font-mono text-sm resize-none focus:outline-none"
              placeholder="Enter markdown content..."
              spellCheck={false}
            />
          </div>

          {/* Preview Panel */}
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-tertiary)]/50">
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Preview
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="prose prose-invert prose-sm max-w-none ledger-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={MARKDOWN_COMPONENTS}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border)] bg-[var(--bg-tertiary)]/50">
          <div className="text-xs text-[var(--text-muted)]">
            Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]">⌘S</kbd> to save
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {content.length.toLocaleString()} characters
          </div>
        </div>
      </div>
    </div>
  );
}
