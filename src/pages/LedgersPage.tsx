import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLedgers } from '../hooks/useLedgers';
import {
  LedgerCard,
  LedgerStatusBadge,
  LedgerProgressBar,
  ProjectTabs,
} from '../components/ledgers';
import { LedgerViewer, LedgerEditor } from '../components/modals';
import { useToast } from '../hooks/useToast';
import type { EnhancedLedger } from '../types/electron';

type FilterTab = 'all' | 'active' | 'stale' | 'completed';

export function LedgersPage() {
  const navigate = useNavigate();
  const { projectName } = useParams<{ projectName?: string }>();
  const {
    filteredLedgers,
    projects,
    selectedLedger,
    selectedProjectPath,
    statusFilter,
    isLoading,
    counts,
    setSelectedLedger,
    setSelectedProject,
    setStatusFilter,
    loadLedgers,
    resumeFromLedger,
    readLedger,
    writeLedger,
  } = useLedgers();

  const { success: showSuccess, error: showError } = useToast();
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [ledgerContent, setLedgerContent] = useState('');

  // Sync project selection with URL param
  useEffect(() => {
    if (projectName) {
      const project = projects.find((p) => p.projectName === projectName);
      if (project) {
        setSelectedProject(project.projectPath);
      }
    } else {
      setSelectedProject(null);
    }
  }, [projectName, projects, setSelectedProject]);

  const handleSelectLedger = useCallback(
    (ledger: EnhancedLedger) => {
      setSelectedLedger(ledger.path);
    },
    [setSelectedLedger]
  );

  const handleResume = useCallback(
    async (ledger: EnhancedLedger) => {
      const result = await resumeFromLedger(ledger);
      if (result.success) {
        showSuccess('Session started from ledger');
        navigate('/');
      } else {
        showError(result.error || 'Failed to resume from ledger');
      }
    },
    [resumeFromLedger, showSuccess, showError, navigate]
  );

  const handleOpenViewer = useCallback(
    async (ledger: EnhancedLedger) => {
      setSelectedLedger(ledger.path);
      setIsViewerOpen(true);
    },
    [setSelectedLedger]
  );

  const handleOpenEditor = useCallback(
    async (ledger: EnhancedLedger) => {
      const result = await readLedger(ledger.path);
      if (result.content) {
        setSelectedLedger(ledger.path);
        setLedgerContent(result.content);
        setIsEditorOpen(true);
        setIsViewerOpen(false);
      } else {
        showError(result.error || 'Failed to load ledger');
      }
    },
    [readLedger, setSelectedLedger, showError]
  );

  const handleSaveLedger = useCallback(
    async (content: string) => {
      if (!selectedLedger) return;
      const result = await writeLedger(selectedLedger.path, content);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save ledger');
      }
      setLedgerContent(content);
    },
    [selectedLedger, writeLedger]
  );

  const handleViewFullPage = useCallback(
    (ledger: EnhancedLedger) => {
      // Navigate to detail page with encoded path
      const encodedPath = btoa(ledger.path);
      navigate(`/ledger/${encodedPath}`);
    },
    [navigate]
  );

  const handleProjectSelect = useCallback(
    (projectPath: string | null) => {
      setSelectedProject(projectPath);
      if (projectPath) {
        const project = projects.find((p) => p.projectPath === projectPath);
        if (project) {
          navigate(`/ledgers/${project.projectName}`);
        }
      } else {
        navigate('/ledgers');
      }
    },
    [setSelectedProject, projects, navigate]
  );

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'stale', label: 'Stale', count: counts.stale },
    { id: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title="Back to sessions"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
            <h1 className="text-xl font-semibold text-gradient">Ledgers</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Cross-project continuity ledgers for managing work state
            </p>
            </div>
          </div>
          <button
            onClick={() => loadLedgers()}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </header>

        {/* Project Tabs */}
        <div className="px-6 py-3 border-b border-[var(--border)]">
          <ProjectTabs
            projects={projects}
            selectedProjectPath={selectedProjectPath}
            onSelectProject={handleProjectSelect}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-[var(--border)]">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 ${
                statusFilter === tab.id
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  statusFilter === tab.id ? 'bg-white/20' : 'bg-[var(--bg-secondary)]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Ledgers grid */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
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
                <p className="text-sm text-[var(--text-muted)]">Loading ledgers...</p>
              </div>
            </div>
          ) : filteredLedgers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg
                className="w-16 h-16 text-[var(--text-muted)] mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">
                No ledgers found
              </h3>
              <p className="text-sm text-[var(--text-muted)] max-w-md mb-4">
                Create continuity ledgers in your projects under{' '}
                <code className="text-[var(--accent-primary)]">thoughts/ledgers/</code>{' '}
                to track work state across sessions.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLedgers.map((ledger) => (
                <LedgerCard
                  key={ledger.path}
                  ledger={ledger}
                  isSelected={ledger.path === selectedLedger?.path}
                  onSelect={() => handleSelectLedger(ledger)}
                  onResume={() => handleResume(ledger)}
                  onEdit={() => handleOpenEditor(ledger)}
                  onView={() => handleViewFullPage(ledger)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar - Selected ledger details */}
      {selectedLedger && (
        <aside className="w-80 border-l border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden flex flex-col">
          {/* Ledger header */}
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-[var(--text-primary)] truncate">
                {selectedLedger.name}
              </h3>
              <button
                onClick={() => setSelectedLedger(null)}
                className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
              >
                <svg
                  className="w-4 h-4"
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
            <LedgerStatusBadge status={selectedLedger.status} size="md" />
          </div>

          {/* Ledger info */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Goal */}
            {selectedLedger.goal && (
              <div>
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
                  Goal
                </p>
                <p className="text-sm text-[var(--text-primary)]">{selectedLedger.goal}</p>
              </div>
            )}

            {/* Current Phase */}
            {selectedLedger.currentPhase && (
              <div>
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
                  Current Phase
                </p>
                <p className="text-sm text-[var(--purple)]">{selectedLedger.currentPhase}</p>
              </div>
            )}

            {/* Progress */}
            <div>
              <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Progress
              </p>
              <LedgerProgressBar progress={selectedLedger.progress} size="md" />
            </div>

            {/* Project */}
            <div>
              <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
                Project
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {selectedLedger.projectPath}
              </p>
            </div>

            {/* Open Questions Indicator */}
            {selectedLedger.hasOpenQuestions && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/30">
                <svg
                  className="w-4 h-4 text-[var(--warning)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-xs text-[var(--warning)]">Has open questions</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-[var(--border)] space-y-2">
            <button
              onClick={() => handleResume(selectedLedger)}
              className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/80 transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
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
              Resume Session
            </button>
            <button
              onClick={() => handleOpenEditor(selectedLedger)}
              className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
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
              Open Editor
            </button>
            <button
              onClick={() => handleOpenViewer(selectedLedger)}
              className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              View Full
            </button>
          </div>
        </aside>
      )}

      {/* Ledger Viewer Modal */}
      {selectedLedger && (
        <LedgerViewer
          ledger={selectedLedger}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          onEdit={() => handleOpenEditor(selectedLedger)}
          onResume={() => handleResume(selectedLedger)}
        />
      )}

      {/* Ledger Editor Modal */}
      {selectedLedger && (
        <LedgerEditor
          ledger={selectedLedger}
          initialContent={ledgerContent}
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleSaveLedger}
        />
      )}
    </div>
  );
}
