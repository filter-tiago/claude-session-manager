import { useCallback, useState } from 'react';
import { useSessions, useSession } from './hooks';
import { useSessionStore } from './stores/sessionStore';
import { SessionGrid, ConversationViewer, NewSessionDialog } from './components';

function App() {
  const { selectedSessionId, setSelectedSession } = useSessionStore();
  const {
    filteredSessions,
    stats,
    searchQuery,
    isLoading: sessionsLoading,
    search,
    refresh,
    reindex,
  } = useSessions();

  const {
    session: selectedSession,
    events,
    isLoading: sessionLoading,
  } = useSession(selectedSessionId);

  const handleSelectSession = useCallback(
    (id: string) => {
      setSelectedSession(id);
    },
    [setSelectedSession]
  );

  const handleCloseConversation = useCallback(() => {
    setSelectedSession(null);
  }, [setSelectedSession]);

  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);

  const handleSpawnSession = useCallback(
    async (projectPath: string, options?: { task?: string; ledger?: string }) => {
      const result = await window.electronAPI.spawnSession(projectPath, options);
      if (!result.success) {
        throw new Error(result.error || 'Failed to spawn session');
      }
      // Refresh sessions list
      refresh();
    },
    [refresh]
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Title bar drag region */}
      <div className="h-8 bg-[var(--bg-secondary)] flex items-center justify-between px-4 app-drag-region border-b border-[var(--border)]">
        <span className="text-sm text-[var(--text-secondary)] font-medium">
          Claude Session Manager
        </span>
        <div className="flex items-center gap-2 app-no-drag">
          <button
            onClick={refresh}
            className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="Refresh sessions"
          >
            <svg
              className="w-4 h-4 text-[var(--text-secondary)]"
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
            className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="Reindex all sessions"
          >
            <svg
              className="w-4 h-4 text-[var(--text-secondary)]"
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
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-72 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-[var(--border)]">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]"
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
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => search(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto">
            {filteredSessions.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-secondary)]">
                <p className="text-sm">No sessions found</p>
                <p className="text-xs mt-1">
                  Sessions will appear here as they're detected
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredSessions.map((session) => (
                  <SidebarSessionItem
                    key={session.session_id}
                    session={session}
                    isSelected={selectedSessionId === session.session_id}
                    onClick={() => handleSelectSession(session.session_id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border)]">
            <button
              onClick={() => setIsNewSessionDialogOpen(true)}
              className="w-full px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              New Session
            </button>
          </div>
        </aside>

        {/* Main panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
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
            />
          )}
        </main>
      </div>

      {/* New Session Dialog */}
      <NewSessionDialog
        isOpen={isNewSessionDialogOpen}
        onClose={() => setIsNewSessionDialogOpen(false)}
        onSpawn={handleSpawnSession}
      />
    </div>
  );
}

interface SidebarSessionItemProps {
  session: {
    session_id: string;
    project_name: string;
    status: 'active' | 'idle' | 'completed';
    detected_task?: string;
    last_activity: string;
    tmux_session?: string;
    tmux_pane?: string;
  };
  isSelected: boolean;
  onClick: () => void;
}

function SidebarSessionItem({
  session,
  isSelected,
  onClick,
}: SidebarSessionItemProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-[var(--success)]';
      case 'idle':
        return 'bg-[var(--warning)]';
      case 'completed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 text-left rounded-lg transition-colors ${
        isSelected
          ? 'bg-[var(--bg-tertiary)] border border-[var(--accent-primary)]'
          : 'hover:bg-[var(--bg-tertiary)] border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(session.status)} ${
            session.status === 'active' ? 'status-active' : ''
          }`}
        />
        <span className="text-sm font-medium truncate">{session.project_name}</span>
      </div>

      {session.tmux_session && session.tmux_pane && (
        <div className="text-xs text-[var(--text-secondary)] mb-1 font-mono">
          {session.tmux_session}:{session.tmux_pane}
        </div>
      )}

      {session.detected_task && (
        <div className="text-xs text-[var(--text-secondary)] truncate mb-1">
          {session.detected_task}
        </div>
      )}

      <div className="text-xs text-[var(--text-secondary)]">
        {formatTime(session.last_activity)}
      </div>
    </button>
  );
}

export default App;
