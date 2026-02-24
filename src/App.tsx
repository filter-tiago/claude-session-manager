import { useCallback, useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate, Link } from 'react-router-dom';
import { useSessions, useSessionSubscription, useSession, useToast } from './hooks';
import { useSessionStore } from './stores/sessionStore';
import {
  SessionGrid,
  ConversationViewer,
  NewSessionDialog,
  SessionsList,
  LedgersBrowser,
  TmuxBrowser,
  Navigation,
  ToastContainer,
  AISearchBar,
} from './components';
import type { Ledger, AISearchMatch } from './types/electron';

// 4A: Route-based code splitting — lazy-load all page components
// Each page uses named exports, so we remap to default for React.lazy
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const HooksPage = lazy(() => import('./pages/HooksPage').then(m => ({ default: m.HooksPage })));
const SkillsPage = lazy(() => import('./pages/SkillsPage').then(m => ({ default: m.SkillsPage })));
const RulesPage = lazy(() => import('./pages/RulesPage').then(m => ({ default: m.RulesPage })));
const PluginsPage = lazy(() => import('./pages/PluginsPage').then(m => ({ default: m.PluginsPage })));
const MCPPage = lazy(() => import('./pages/MCPPage').then(m => ({ default: m.MCPPage })));
const InsightsPage = lazy(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage').then(m => ({ default: m.NotificationSettingsPage })));
const WorkspacesPage = lazy(() => import('./pages/WorkspacesPage').then(m => ({ default: m.WorkspacesPage })));
const LedgersPage = lazy(() => import('./pages/LedgersPage').then(m => ({ default: m.LedgersPage })));
const LedgerDetailPage = lazy(() => import('./pages/LedgerDetailPage').then(m => ({ default: m.LedgerDetailPage })));
const TmuxPage = lazy(() => import('./pages/TmuxPage').then(m => ({ default: m.TmuxPage })));

// 4B: Lazy-load modals — only loaded when first opened
const LedgerViewer = lazy(() => import('./components/modals/LedgerViewer').then(m => ({ default: m.LedgerViewer })));
const LedgerEditor = lazy(() => import('./components/modals/LedgerEditor').then(m => ({ default: m.LedgerEditor })));
const SplitSessionDialog = lazy(() => import('./components/modals/SplitSessionDialog').then(m => ({ default: m.SplitSessionDialog })));
const CommandPalette = lazy(() => import('./components/modals/CommandPalette').then(m => ({ default: m.CommandPalette })));
const KeyboardShortcutsHelp = lazy(() => import('./components/modals/KeyboardShortcutsHelp').then(m => ({ default: m.KeyboardShortcutsHelp })));

function SessionsPage() {
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);
  const setSelectedSession = useSessionStore((s) => s.setSelectedSession);
  const filters = useSessionStore((s) => s.filters);
  const sessions = useSessionStore((s) => s.sessions);
  const {
    filteredSessions,
    stats,
    searchQuery,
    isLoading: sessionsLoading,
    isLoadingMore,
    hasMoreSessions,
    search,
    refresh,
    filterMode,
    totalCount,
    loadAllSessions,
    loadMoreSessions,
    setProjectFilter,
    resetToSmartFiltering,
  } = useSessions();

  const [projects, setProjects] = useState<Array<{ project_path: string; project_name: string }>>([]);

  // Fetch distinct projects when raw sessions array changes (1C fix)
  // Using `sessions` instead of `filteredSessions` to avoid infinite loop —
  // filteredSessions is a new array reference every render, but sessions
  // only changes when the store is actually updated.
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await window.electronAPI.getDistinctProjects();
        setProjects(data);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      }
    };
    fetchProjects();
  }, [sessions]); // Re-fetch when sessions change (new projects may appear)

  const {
    session: selectedSession,
    events,
    isLoading: sessionLoading,
  } = useSession(selectedSessionId);

  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null);
  const [isLedgerViewerOpen, setIsLedgerViewerOpen] = useState(false);
  const [isLedgerEditorOpen, setIsLedgerEditorOpen] = useState(false);
  const [ledgerContent, setLedgerContent] = useState('');
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);

  const handleSelectSession = useCallback(
    (id: string) => {
      setSelectedSession(id);
    },
    [setSelectedSession]
  );

  const handleCloseConversation = useCallback(() => {
    setSelectedSession(null);
  }, [setSelectedSession]);

  const handleSpawnSession = useCallback(
    async (projectPath: string, options?: { task?: string; ledger?: string }) => {
      const result = await window.electronAPI.spawnSession(projectPath, options);
      if (!result.success) {
        throw new Error(result.error || 'Failed to spawn session');
      }
      refresh();
    },
    [refresh]
  );

  const handleSelectLedger = useCallback((ledger: Ledger) => {
    setSelectedLedger(ledger);
    setIsLedgerViewerOpen(true);
  }, []);

  const handleCloseLedgerViewer = useCallback(() => {
    setIsLedgerViewerOpen(false);
  }, []);

  const handleEditLedger = useCallback(async (ledger: Ledger) => {
    try {
      const content = await window.electronAPI.readLedger(ledger.path);
      setLedgerContent(content);
      setIsLedgerViewerOpen(false);
      setIsLedgerEditorOpen(true);
    } catch (error) {
      console.error('Failed to load ledger for editing:', error);
    }
  }, []);

  const handleCloseLedgerEditor = useCallback(() => {
    setIsLedgerEditorOpen(false);
  }, []);

  const handleSaveLedger = useCallback(async (content: string) => {
    if (!selectedLedger) return;

    const result = await window.electronAPI.writeLedger(selectedLedger.path, content);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save ledger');
    }
    setLedgerContent(content);
  }, [selectedLedger]);

  const handleCreateHandoff = useCallback(async () => {
    if (!selectedSession) return;

    try {
      const result = await window.electronAPI.createHandoff(selectedSession.session_id);
      if (result.success) {
        console.log('Handoff created:', result.path);
        // Could show a toast here
      } else {
        console.error('Failed to create handoff:', result.error);
      }
    } catch (error) {
      console.error('Failed to create handoff:', error);
    }
  }, [selectedSession]);

  const handleOpenSplitDialog = useCallback(() => {
    setIsSplitDialogOpen(true);
  }, []);

  const handleCloseSplitDialog = useCallback(() => {
    setIsSplitDialogOpen(false);
  }, []);

  const handleSplitSession = useCallback(async (task: string) => {
    if (!selectedSession) return;

    const result = await window.electronAPI.splitSession(
      selectedSession.session_id,
      task
    );
    if (!result.success) {
      throw new Error(result.error || 'Failed to split session');
    }
    refresh();
  }, [selectedSession, refresh]);

  const handleResumeFromLedger = useCallback(async (ledger: Ledger) => {
    try {
      const result = await window.electronAPI.resumeFromLedger(
        ledger.projectPath,
        ledger.filename
      );
      if (!result.success) {
        throw new Error(result.error || 'Failed to spawn session');
      }
      setIsLedgerViewerOpen(false);
      refresh();
    } catch (error) {
      console.error('Failed to resume from ledger:', error);
    }
  }, [refresh]);

  const handleOpenInTerminal = useCallback(async () => {
    if (!selectedSession) return;

    try {
      const result = await window.electronAPI.openSessionTerminal(selectedSession);
      if (!result.success) {
        console.error('Failed to open in terminal:', result.error);
      }
    } catch (error) {
      console.error('Failed to open in terminal:', error);
    }
  }, [selectedSession]);

  // 3D: Stable callback for project filter (avoids inline closure)
  const handleProjectFilter = useCallback((projectPath: string | undefined) => {
    void setProjectFilter(projectPath);
  }, [setProjectFilter]);

  // 3D: Stable callback for closing new session dialog
  const handleCloseNewSessionDialog = useCallback(() => {
    setIsNewSessionDialogOpen(false);
  }, []);

  return (
    <>
      {/* Main Layout - 3 Panel with glass effects */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - glass panel */}
        <aside className="w-56 glass border-r border-[var(--border)] flex flex-col">
          {/* Sessions List */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <SessionsList
              sessions={filteredSessions}
              selectedSessionId={selectedSessionId}
              onSelectSession={handleSelectSession}
              searchQuery={searchQuery}
              onSearch={search}
            />
          </div>

          {/* Ledgers Browser */}
          <div className="border-t border-[var(--border)]">
            <LedgersBrowser
              onSelectLedger={handleSelectLedger}
              selectedLedgerPath={selectedLedger?.path}
            />
          </div>

          {/* Tmux Browser */}
          <div className="border-t border-[var(--border)]">
            <TmuxBrowser />
          </div>

          {/* Navigation */}
          <Navigation />
        </aside>

        {/* Main Panel - subtle glass */}
        <main className="flex-1 flex flex-col overflow-hidden glass-subtle">
          {selectedSession ? (
            <ConversationViewer
              session={selectedSession}
              events={events}
              isLoading={sessionLoading}
              onClose={handleCloseConversation}
            />
          ) : (
            <SessionGrid
              sessions={filteredSessions}
              stats={stats}
              selectedSessionId={selectedSessionId}
              onSelectSession={handleSelectSession}
              isLoading={sessionsLoading}
              filterMode={filterMode}
              totalCount={totalCount}
              onShowAll={loadAllSessions}
              onLoadMore={loadMoreSessions}
              onResetFilter={resetToSmartFiltering}
              searchQuery={searchQuery}
              hasMoreSessions={hasMoreSessions}
              isLoadingMore={isLoadingMore}
              projects={projects}
              selectedProject={filters.project}
              onProjectFilter={handleProjectFilter}
            />
          )}
        </main>

        {/* Right Sidebar - glass panel, conditional */}
        {selectedSession && (
          <aside className="w-72 glass border-l border-[var(--border)]">
            {/* Context panel with glass effect */}
            <div className="p-4 text-sm text-[var(--text-secondary)] animate-fade-in">
              <h3 className="font-medium text-gradient mb-3">Session Context</h3>
              <div className="space-y-3">
                <div className="glass-subtle rounded-lg p-2">
                  <p className="text-xs text-[var(--text-muted)]">Project</p>
                  <p className="text-sm text-[var(--text-primary)]">{selectedSession.project_name}</p>
                </div>
                <div className="glass-subtle rounded-lg p-2">
                  <p className="text-xs text-[var(--text-muted)]">Status</p>
                  <span className={`inline-flex items-center gap-1.5 text-sm ${
                    selectedSession.status === 'active' ? 'text-[var(--success)]' :
                    selectedSession.status === 'idle' ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      selectedSession.status === 'active' ? 'bg-[var(--success)] status-active' :
                      selectedSession.status === 'idle' ? 'bg-[var(--warning)]' : 'bg-gray-500'
                    }`} />
                    {selectedSession.status}
                  </span>
                </div>
                {selectedSession.detected_task && (
                  <div className="glass-subtle rounded-lg p-2">
                    <p className="text-xs text-[var(--text-muted)]">Task</p>
                    <p className="text-sm text-[var(--text-primary)]">{selectedSession.detected_task}</p>
                  </div>
                )}
                {selectedSession.ledger_link && (
                  <div className="glass-subtle rounded-lg p-2">
                    <p className="text-xs text-[var(--text-muted)]">Ledger</p>
                    <p className="text-sm text-[var(--accent-primary)]">{selectedSession.ledger_link}</p>
                  </div>
                )}
              </div>

              {/* Session Actions */}
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                  Actions
                </h4>
                <div className="space-y-2">
                  <button
                    onClick={handleOpenInTerminal}
                    className="w-full px-3 py-2 text-left text-sm rounded-lg glass-subtle hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Open in Terminal
                  </button>
                  <button
                    onClick={handleCreateHandoff}
                    className="w-full px-3 py-2 text-left text-sm rounded-lg glass-subtle hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-[var(--purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Create Handoff
                  </button>
                  <button
                    onClick={handleOpenSplitDialog}
                    className="w-full px-3 py-2 text-left text-sm rounded-lg glass-subtle hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Split to New Session
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Ledger Viewer Modal — lazy-loaded, only mounted when open */}
      {isLedgerViewerOpen && (
        <Suspense fallback={null}>
          <LedgerViewer
            ledger={selectedLedger}
            isOpen={isLedgerViewerOpen}
            onClose={handleCloseLedgerViewer}
            onEdit={handleEditLedger}
            onResume={handleResumeFromLedger}
          />
        </Suspense>
      )}

      {/* Ledger Editor Modal — lazy-loaded, only mounted when open */}
      {isLedgerEditorOpen && (
        <Suspense fallback={null}>
          <LedgerEditor
            ledger={selectedLedger}
            initialContent={ledgerContent}
            isOpen={isLedgerEditorOpen}
            onClose={handleCloseLedgerEditor}
            onSave={handleSaveLedger}
          />
        </Suspense>
      )}

      {/* Split Session Dialog — lazy-loaded, only mounted when open */}
      {isSplitDialogOpen && (
        <Suspense fallback={null}>
          <SplitSessionDialog
            session={selectedSession}
            isOpen={isSplitDialogOpen}
            onClose={handleCloseSplitDialog}
            onSplit={handleSplitSession}
          />
        </Suspense>
      )}

      {/* New Session Dialog */}
      <NewSessionDialog
        isOpen={isNewSessionDialogOpen}
        onClose={handleCloseNewSessionDialog}
        onSpawn={handleSpawnSession}
      />
    </>
  );
}

// 3D: Module-level noop to avoid creating new function references
const noop = () => {};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  // 1D: Single subscription at App root — no more duplicate IPC listeners
  const { loadSessions: refresh, loadStatsImmediate } = useSessionSubscription();
  const sessions = useSessionStore((s) => s.sessions);
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);
  const setSelectedSession = useSessionStore((s) => s.setSelectedSession);
  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [selectedLedgerForPalette, setSelectedLedgerForPalette] = useState<Ledger | null>(null);
  const [isLedgerViewerOpen, setIsLedgerViewerOpen] = useState(false);
  const { toasts, dismissToast, error: showError, success: showSuccess } = useToast();

  // Reindex function for App-level usage (replaces useSessions().reindex)
  const setLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);
  const reindex = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI?.reindex();
      await refresh();
      await loadStatsImmediate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reindex failed';
      console.error('Failed to reindex:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, refresh, loadStatsImmediate]);

  const isSessionsPage = location.pathname === '/';

  // Fetch ledgers for command palette
  useEffect(() => {
    const fetchLedgers = async () => {
      try {
        const data = await window.electronAPI.getLedgers();
        setLedgers(data);
      } catch (error) {
        console.error('Failed to fetch ledgers:', error);
      }
    };
    fetchLedgers();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // ⌘K - Command Palette (always works)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
        } else if (isShortcutsHelpOpen) {
          setIsShortcutsHelpOpen(false);
        } else if (isNewSessionDialogOpen) {
          setIsNewSessionDialogOpen(false);
        } else if (isLedgerViewerOpen) {
          setIsLedgerViewerOpen(false);
        } else if (selectedSessionId && isSessionsPage) {
          setSelectedSession(null);
        }
        return;
      }

      // Skip remaining shortcuts if typing
      if (isTyping) return;

      // ⌘N - New Session
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setIsNewSessionDialogOpen(true);
        return;
      }

      // ⌘R - Refresh Sessions
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        refresh();
        return;
      }

      // ⌘, - Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
        return;
      }

      // ⌘L - Ledgers
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        navigate('/ledgers');
        return;
      }

      // ? - Keyboard shortcuts help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsShortcutsHelpOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isCommandPaletteOpen,
    isShortcutsHelpOpen,
    isNewSessionDialogOpen,
    isLedgerViewerOpen,
    selectedSessionId,
    isSessionsPage,
    setSelectedSession,
    refresh,
    navigate,
  ]);

  const handleCommandPaletteSelectSession = useCallback((sessionId: string) => {
    setSelectedSession(sessionId);
  }, [setSelectedSession]);

  const handleCommandPaletteSelectLedger = useCallback((ledger: Ledger) => {
    setSelectedLedgerForPalette(ledger);
    setIsLedgerViewerOpen(true);
  }, []);

  const handleAISearchSelect = useCallback((match: AISearchMatch) => {
    if (match.type === 'session' && match.sessionId) {
      setSelectedSession(match.sessionId);
      navigate('/');
    } else if (match.type === 'ledger' && match.path) {
      navigate(`/ledger/${encodeURIComponent(match.path)}`);
    }
  }, [setSelectedSession, navigate]);

  // 3D: Stable callbacks for inline closures passed to child components
  const handleOpenCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(true);
  }, []);

  const handleCloseCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
  }, []);

  const handleOpenNewSession = useCallback(() => {
    setIsNewSessionDialogOpen(true);
  }, []);

  const handleCloseNewSessionApp = useCallback(() => {
    setIsNewSessionDialogOpen(false);
  }, []);

  const handleCloseShortcutsHelp = useCallback(() => {
    setIsShortcutsHelpOpen(false);
  }, []);

  const handleCloseLedgerViewerApp = useCallback(() => {
    setIsLedgerViewerOpen(false);
  }, []);

  const handleSpawnSessionApp = useCallback(async (projectPath: string, options?: { task?: string; ledger?: string }) => {
    const result = await window.electronAPI.spawnSession(projectPath, options);
    if (!result.success) {
      throw new Error(result.error || 'Failed to spawn session');
    }
  }, []);

  const handleResumeFromLedgerApp = useCallback(async (ledger: Ledger) => {
    const result = await window.electronAPI.resumeFromLedger(
      ledger.projectPath,
      ledger.filename
    );
    if (!result.success) {
      showError('Failed to resume from ledger: ' + result.error);
    } else {
      showSuccess('Session started from ledger');
    }
    setIsLedgerViewerOpen(false);
    refresh();
  }, [showError, showSuccess, refresh]);

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar - glass effect with gradient logo */}
      <header className="h-10 glass-strong flex items-center justify-between pl-20 pr-4 app-drag-region border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          {/* Logo/Icon with gradient */}
          <Link to="/" className="flex items-center gap-3 app-no-drag">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg glow-accent">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-gradient">
              Claude Session Manager
            </span>
          </Link>
        </div>

        {/* AI Search Bar - center section */}
        <div className="flex-1 max-w-md mx-4 app-no-drag">
          <AISearchBar onSelect={handleAISearchSelect} />
        </div>

        {/* Actions - always show search button, other actions only on sessions page */}
        <div className="flex items-center gap-2 app-no-drag">
          {/* Command Palette Button */}
          <button
            onClick={handleOpenCommandPalette}
            className="flex items-center gap-2 px-2.5 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--border)] rounded-lg transition-colors"
            title="Command Palette (⌘K)"
          >
            <svg
              className="w-3.5 h-3.5 text-[var(--text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span className="text-[var(--text-muted)]">Search...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded">
              ⌘K
            </kbd>
          </button>

          {isSessionsPage && (
            <>
              <div className="w-px h-4 bg-[var(--border)] mx-1" />
              <button
                onClick={() => refresh()}
                className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:glow-accent rounded-lg transition-colors duration-200"
                title="Refresh sessions"
              >
                <svg
                  className="w-4 h-4 text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <button
                onClick={reindex}
                className="p-1.5 hover:bg-[var(--bg-tertiary)] hover:glow-secondary rounded-lg transition-colors duration-200"
                title="Reindex all sessions"
              >
                <svg
                  className="w-4 h-4 text-[var(--text-secondary)] hover:text-[var(--accent-secondary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  />
                </svg>
              </button>
              <div className="w-px h-4 bg-[var(--border)] mx-1" />
              <button
                onClick={handleOpenNewSession}
                className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-xs font-medium hover:shadow-lg hover:glow-accent transition-colors duration-200"
              >
                New Session
              </button>
            </>
          )}
        </div>
      </header>

      {/* Routes — wrapped in Suspense for lazy-loaded pages */}
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<SessionsPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/ledgers" element={<LedgersPage />} />
          <Route path="/ledgers/:projectName" element={<LedgersPage />} />
          <Route path="/ledger/:ledgerPath" element={<LedgerDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationSettingsPage />} />
          <Route path="/hooks" element={<HooksPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/plugins" element={<PluginsPage />} />
          <Route path="/mcp" element={<MCPPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/tmux" element={<TmuxPage />} />
        </Routes>
      </Suspense>

      {/* New Session Dialog - available globally */}
      <NewSessionDialog
        isOpen={isNewSessionDialogOpen}
        onClose={handleCloseNewSessionApp}
        onSpawn={handleSpawnSessionApp}
      />

      {/* Command Palette — lazy-loaded, only mounted when open */}
      {isCommandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={handleCloseCommandPalette}
            sessions={sessions}
            ledgers={ledgers}
            onSelectSession={handleCommandPaletteSelectSession}
            onSelectLedger={handleCommandPaletteSelectLedger}
            onNewSession={handleOpenNewSession}
            onRefresh={refresh}
            onReindex={reindex}
          />
        </Suspense>
      )}

      {/* Ledger Viewer for command palette selections — lazy-loaded */}
      {isLedgerViewerOpen && (
        <Suspense fallback={null}>
          <LedgerViewer
            ledger={selectedLedgerForPalette}
            isOpen={isLedgerViewerOpen}
            onClose={handleCloseLedgerViewerApp}
            onEdit={noop}
            onResume={handleResumeFromLedgerApp}
          />
        </Suspense>
      )}

      {/* Keyboard Shortcuts Help — lazy-loaded, only mounted when open */}
      {isShortcutsHelpOpen && (
        <Suspense fallback={null}>
          <KeyboardShortcutsHelp
            isOpen={isShortcutsHelpOpen}
            onClose={handleCloseShortcutsHelp}
          />
        </Suspense>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
