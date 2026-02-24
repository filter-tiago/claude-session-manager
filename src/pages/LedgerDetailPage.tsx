import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLedgers } from '../hooks/useLedgers';
import { LedgerStatusBadge, LedgerProgressBar } from '../components/ledgers';
import { useToast } from '../hooks/useToast';
import type { EnhancedLedger } from '../types/electron';

export function LedgerDetailPage() {
  const navigate = useNavigate();
  const { ledgerPath: encodedPath } = useParams<{ ledgerPath: string }>();
  const {
    ledgers,
    resumeFromLedger,
    readLedger,
    writeLedger,
    loadLedgers,
    isLoading,
  } = useLedgers();
  const { success: showSuccess, error: showError } = useToast();

  const [ledger, setLedger] = useState<EnhancedLedger | null>(null);
  const [content, setContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Decode path and find ledger
  useEffect(() => {
    if (encodedPath) {
      try {
        const decodedPath = atob(encodedPath);
        const found = ledgers.find((l) => l.path === decodedPath);
        if (found) {
          setLedger(found);
        }
      } catch {
        showError('Invalid ledger path');
        navigate('/ledgers');
      }
    }
  }, [encodedPath, ledgers, navigate, showError]);

  // Load ledger content
  useEffect(() => {
    const loadContent = async () => {
      if (ledger) {
        const result = await readLedger(ledger.path);
        if (result.content) {
          setContent(result.content);
          setEditedContent(result.content);
        } else {
          showError(result.error || 'Failed to load ledger');
        }
      }
    };
    loadContent();
  }, [ledger, readLedger, showError]);

  // Track changes
  useEffect(() => {
    setHasChanges(editedContent !== content);
  }, [editedContent, content]);

  const handleSave = useCallback(async () => {
    if (!ledger || !hasChanges) return;

    setIsSaving(true);
    try {
      const result = await writeLedger(ledger.path, editedContent);
      if (result.success) {
        setContent(editedContent);
        setHasChanges(false);
        showSuccess('Ledger saved successfully');
        await loadLedgers();
      } else {
        showError(result.error || 'Failed to save ledger');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save ledger');
    } finally {
      setIsSaving(false);
    }
  }, [ledger, editedContent, hasChanges, writeLedger, showSuccess, showError, loadLedgers]);

  const handleResume = useCallback(async () => {
    if (!ledger) return;

    const result = await resumeFromLedger(ledger);
    if (result.success) {
      showSuccess('Session started from ledger');
      navigate('/');
    } else {
      showError(result.error || 'Failed to resume from ledger');
    }
  }, [ledger, resumeFromLedger, showSuccess, showError, navigate]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate('/ledgers');
      }
    } else {
      navigate('/ledgers');
    }
  }, [hasChanges, navigate]);

  if (isLoading || !ledger) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="w-8 h-8 animate-spin text-[var(--accent-primary)]"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm text-[var(--text-muted)]">Loading ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                {ledger.name}
              </h1>
              <LedgerStatusBadge status={ledger.status} size="md" />
              {hasChanges && (
                <span className="px-2 py-0.5 text-xs font-medium bg-[var(--warning)]/20 text-[var(--warning)] rounded">
                  Unsaved
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {ledger.projectName} &middot; {ledger.progress.completed}/{ledger.progress.total} phases
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              isEditing
                ? 'bg-[var(--purple)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            {isEditing ? 'Preview' : 'Edit'}
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--success)] text-white hover:bg-[var(--success)]/80 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save
                </>
              )}
            </button>
          )}
          <button
            onClick={handleResume}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/80 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Resume
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {isEditing ? (
          // Edit mode - two-panel split
          <div className="flex-1 flex divide-x divide-[var(--border)]">
            {/* Editor */}
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                <span className="text-xs font-medium text-[var(--text-muted)]">Editor</span>
              </div>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="flex-1 p-4 bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-sm resize-none focus:outline-none"
                spellCheck={false}
              />
            </div>
            {/* Preview */}
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                <span className="text-xs font-medium text-[var(--text-muted)]">Preview</span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-[var(--text-secondary)]">
                    {editedContent}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // View mode - full width preview
          <div className="flex-1 flex flex-col">
            {/* Info bar */}
            <div className="px-6 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center gap-6">
              {ledger.currentPhase && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Current:</span>
                  <span className="text-sm text-[var(--purple)]">{ledger.currentPhase}</span>
                </div>
              )}
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <span className="text-xs font-medium text-[var(--text-muted)]">Progress:</span>
                <div className="flex-1">
                  <LedgerProgressBar progress={ledger.progress} size="md" />
                </div>
              </div>
              {ledger.hasOpenQuestions && (
                <div className="flex items-center gap-1 text-[var(--warning)]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs">Open questions</span>
                </div>
              )}
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-4xl mx-auto">
                <pre className="whitespace-pre-wrap text-[var(--text-primary)] font-mono text-sm leading-relaxed">
                  {content}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
