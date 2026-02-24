import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTmuxSessions } from '../hooks/useTmuxSessions';
import { useTerminalPool } from '../hooks/useTerminalPool';
import { useTmuxPaneSnapshot } from '../hooks/useTmuxPaneSnapshot';
import { useTerminalGridStore } from '../stores/terminalGridStore';
import { TmuxSessionCard } from '../components/TmuxSessionCard';
import { TerminalGrid } from '../components/TerminalGrid';
import { TerminalFocusOverlay } from '../components/modals/TerminalFocusOverlay';
import { LoadingSpinner } from '../components/ui';

type FilterTab = 'all' | 'attached' | 'detached' | 'withClaude';

interface FocusedPane {
  paneId: string;
  tmuxSession: string;
  tmuxPane: string;
}

interface PaneInfo {
  paneId: string;
  tmuxSession: string;
  tmuxPane: string;
  isConnected: boolean;
  isPlaceholder?: boolean;
}

export function TmuxPage() {
  const navigate = useNavigate();
  const { sessions, loading, error, killSession, renameSession, attachSession, refresh } =
    useTmuxSessions();

  const pool = useTerminalPool();
  const { snapshots, captureSnapshot } = useTmuxPaneSnapshot();
  const { columns, viewMode, setColumns, setViewMode, setFocusedPane } =
    useTerminalGridStore();

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedPane, setFocusedPaneLocal] = useState<FocusedPane | null>(null);
  const [tmuxPanes, setTmuxPanes] = useState<Array<{ session: string; window: number; pane: number; pid: number; cwd?: string }>>([]);
  const [panesLoading, setPanesLoading] = useState(true);

  const fetchPanes = useCallback(async () => {
    try {
      const panes = await window.electronAPI.getTmuxPanes();
      setTmuxPanes(panes);
      return panes;
    } catch {
      return [];
    } finally {
      setPanesLoading(false);
    }
  }, []);

  // Fetch tmux panes on mount and periodically (visibility-aware)
  useEffect(() => {
    fetchPanes();
    const interval = setInterval(() => {
      if (!document.hidden) fetchPanes();
    }, 10000);

    const handleVisibilityChange = () => {
      if (!document.hidden) fetchPanes();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchPanes]);

  const handleKill = useCallback(
    async (name: string) => {
      await killSession(name);
    },
    [killSession]
  );

  const handleRename = useCallback(
    async (oldName: string, newName: string) => {
      await renameSession(oldName, newName);
    },
    [renameSession]
  );

  const handleAttach = useCallback(
    async (name: string) => {
      const result = await attachSession(name);
      if (!result.success) {
        console.error('Failed to attach tmux session:', result.error);
      }
    },
    [attachSession]
  );

  const handleNewSession = useCallback(() => {
    const name = window.prompt('New tmux session name:');
    if (!name) return;
    window.electronAPI
      .spawnSession('~', { task: undefined })
      .catch((err: unknown) => {
        console.error('Failed to create tmux session:', err);
      });
  }, []);

  // Build pane list from sessions + tmux panes
  const paneInfos = useMemo((): PaneInfo[] => {
    const result: PaneInfo[] = [];
    for (const session of sessions) {
      // Find panes belonging to this session
      const sessionPanes = tmuxPanes.filter((p) => p.session === session.name);
      if (sessionPanes.length > 0) {
        for (const p of sessionPanes) {
          const paneId = `${p.session}:${p.window}.${p.pane}`;
          result.push({
            paneId,
            tmuxSession: p.session,
            tmuxPane: `${p.window}.${p.pane}`,
            isConnected: pool.connectedPaneIds.has(paneId),
            isPlaceholder: false,
          });
        }
      } else {
        // Session has no pane data yet, create a default entry
        const paneId = `${session.name}:0.0`;
        result.push({
          paneId,
          tmuxSession: session.name,
          tmuxPane: '0.0',
          isConnected: pool.connectedPaneIds.has(paneId),
          isPlaceholder: panesLoading,
        });
      }
    }
    return result;
  }, [sessions, tmuxPanes, pool.connectedPaneIds, panesLoading]);

  // Handle connect/disconnect
  const handleRequestConnect = useCallback(
    async (paneId: string, tmuxSession: string, tmuxPane: string) => {
      void tmuxPane;
      const info = paneInfos.find((p) => p.paneId === paneId);
      if (info?.isPlaceholder) {
        const panes = await fetchPanes();
        const resolved = panes.find((p) => p.session === tmuxSession);
        if (resolved) {
          const resolvedPaneId = `${resolved.session}:${resolved.window}.${resolved.pane}`;
          pool.connect(resolvedPaneId);
        }
        return;
      }

      pool.connect(paneId);
    },
    [pool, paneInfos, fetchPanes]
  );

  const handleRequestDisconnect = useCallback(
    async (paneId: string) => {
      // Capture snapshot before disconnecting
      const info = paneInfos.find((p) => p.paneId === paneId);
      if (info) {
        await captureSnapshot(paneId, info.tmuxSession, info.tmuxPane);
      }
      await pool.disconnect(paneId);
    },
    [pool, paneInfos, captureSnapshot]
  );

  // Handle IPC success: promote connecting -> connected in the pool
  const handleConnectionEstablished = useCallback(
    (paneId: string) => {
      const info = paneInfos.find((p) => p.paneId === paneId);
      if (info) {
        pool.confirmConnection(paneId, info.tmuxSession, info.tmuxPane);
      }
    },
    [pool, paneInfos]
  );

  // Handle IPC failure: remove from connecting set
  const handleConnectionFailed = useCallback(
    (paneId: string) => {
      pool.reportConnectionFailed(paneId);
    },
    [pool]
  );

  // Handle unexpected connection loss (terminal exit, IPC failure)
  // This syncs pool state when the backend connection drops
  const handleConnectionLost = useCallback(
    (paneId: string) => {
      pool.disconnect(paneId);
    },
    [pool]
  );

  // Handle maximize (focus overlay)
  const handleMaximize = useCallback(
    (paneId: string, tmuxSession: string, tmuxPane: string) => {
      setFocusedPaneLocal({ paneId, tmuxSession, tmuxPane });
      setFocusedPane(paneId);
    },
    [setFocusedPane]
  );

  const handleCloseFocus = useCallback(() => {
    setFocusedPaneLocal(null);
    setFocusedPane(null);
  }, [setFocusedPane]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    let result = sessions;

    if (filterTab === 'attached') {
      result = result.filter((s) => s.attached);
    } else if (filterTab === 'detached') {
      result = result.filter((s) => !s.attached);
    } else if (filterTab === 'withClaude') {
      result = result.filter((s) => s.claudeSessions.length > 0);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(query));
    }

    return result;
  }, [sessions, filterTab, searchQuery]);

  // Filter panes to match filtered sessions
  const filteredPanes = useMemo(() => {
    const sessionNames = new Set(filteredSessions.map((s) => s.name));
    return paneInfos.filter((p) => sessionNames.has(p.tmuxSession));
  }, [filteredSessions, paneInfos]);

  // 3E: Memoize filterTabs to avoid recomputing .filter().length on every render
  const filterTabs = useMemo((): { id: FilterTab; label: string; count: number }[] => [
    { id: 'all', label: 'All', count: sessions.length },
    { id: 'attached', label: 'Attached', count: sessions.filter((s) => s.attached).length },
    { id: 'detached', label: 'Detached', count: sessions.filter((s) => !s.attached).length },
    {
      id: 'withClaude',
      label: 'With Claude',
      count: sessions.filter((s) => s.claudeSessions.length > 0).length,
    },
  ], [sessions]);

  const columnOptions = [1, 2, 3, 4] as const;

  return (
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
            <h1 className="text-xl font-semibold text-gradient">Tmux Sessions</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {viewMode === 'terminals'
                ? 'Live terminal tiles with real-time tmux output'
                : 'Manage tmux sessions and their linked Claude processes'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg overflow-hidden border border-[var(--border)]">
            <button
              onClick={() => setViewMode('terminals')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'terminals'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
              title="Terminal view"
            >
              Terminals
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
              title="Card view"
            >
              Cards
            </button>
          </div>

          {/* Column selector (terminal view only) */}
          {viewMode === 'terminals' && (
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-1">
              {columnOptions.map((n) => (
                <button
                  key={n}
                  onClick={() => setColumns(n)}
                  className={`w-6 h-6 text-xs font-medium rounded transition-colors ${
                    columns === n
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                  title={`${n} column${n > 1 ? 's' : ''}`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {/* Pool indicator (terminal view) */}
          {viewMode === 'terminals' && (
            <span className="text-[10px] text-[var(--text-muted)] px-2">
              {pool.connectedPaneIds.size}/6
            </span>
          )}

          {/* Refresh button */}
          <button
            onClick={() => refresh()}
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

          {/* New Session button */}
          <button
            onClick={handleNewSession}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg hover:shadow-lg hover:glow-accent transition-colors"
          >
            New Session
          </button>
        </div>
      </header>

      {/* Filter bar + search */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--border)]">
        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                filterTab === tab.id
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] px-1 py-0.5 rounded ${
                  filterTab === tab.id
                    ? 'bg-white/20'
                    : 'bg-[var(--bg-tertiary)]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-[var(--border)]" />

        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]"
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
          <input
            type="text"
            placeholder="Filter by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg input-glass text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <LoadingSpinner size="lg" className="text-[var(--accent-primary)]" />
              <p className="text-sm text-[var(--text-muted)]">Loading tmux sessions...</p>
            </div>
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg
              className="w-16 h-16 text-[var(--error)] mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">
              Failed to load tmux sessions
            </h3>
            <p className="text-sm text-[var(--text-muted)] max-w-md mb-4">{error}</p>
            <button
              onClick={() => refresh()}
              className="px-4 py-2 text-sm font-medium rounded-lg glass-subtle hover:bg-[var(--bg-tertiary)] text-[var(--accent-primary)] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredSessions.length === 0 ? (
          /* Empty state */
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
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">
              {searchQuery || filterTab !== 'all'
                ? 'No matching sessions'
                : 'No tmux sessions running'}
            </h3>
            <p className="text-sm text-[var(--text-muted)] max-w-md mb-4">
              {searchQuery || filterTab !== 'all'
                ? 'Try adjusting your search or filter to find sessions.'
                : 'Start a new tmux session to manage Claude processes.'}
            </p>
            {!searchQuery && filterTab === 'all' && (
              <button
                onClick={handleNewSession}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg hover:shadow-lg hover:glow-accent transition-colors"
              >
                Create Your First Session
              </button>
            )}
          </div>
        ) : viewMode === 'terminals' ? (
          /* Terminal grid view */
          <TerminalGrid
            sessions={filteredSessions}
            panes={filteredPanes}
            loading={panesLoading}
            columns={columns}
            connectedPaneIds={pool.connectedPaneIds}
            connectingPaneIds={pool.connectingPaneIds}
            snapshots={snapshots}
            onRequestConnect={handleRequestConnect}
            onRequestDisconnect={handleRequestDisconnect}
            onConnectionEstablished={handleConnectionEstablished}
            onConnectionFailed={handleConnectionFailed}
            onConnectionLost={handleConnectionLost}
            onMaximize={handleMaximize}
            onKill={handleKill}
          />
        ) : (
          /* Card grid view (original) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => (
              <TmuxSessionCard
                key={session.name}
                session={session}
                onKill={handleKill}
                onRename={handleRename}
                onAttach={handleAttach}
              />
            ))}
          </div>
        )}
      </div>

      {/* Focus overlay */}
      {focusedPane && (
        <TerminalFocusOverlay
          paneId={focusedPane.paneId}
          tmuxSession={focusedPane.tmuxSession}
          tmuxPane={focusedPane.tmuxPane}
          onClose={handleCloseFocus}
        />
      )}
    </div>
  );
}
