import { memo } from 'react';
import type { Session } from '../../types/electron';

interface SessionsListProps {
  sessions: Session[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
}

export function SessionsList({
  sessions,
  selectedSessionId,
  onSelectSession,
  searchQuery,
  onSearch,
}: SessionsListProps) {
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

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gradient uppercase tracking-wider">
          Sessions
        </span>
        <span className="text-xs text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-2 py-0.5 rounded-full border border-[var(--accent-primary)]/20">
          {sessions.length}
        </span>
      </div>

      {/* Search - glassmorphic */}
      <div className="px-3 pb-2">
        <div className="relative">
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
            placeholder="Filter sessions..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 input-glass rounded-lg text-xs placeholder:text-[var(--text-muted)]"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2">
        {sessions.length === 0 ? (
          <div className="px-3 py-4 text-center text-[var(--text-secondary)]">
            <p className="text-xs">No sessions found</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((session) => (
              <SessionItem
                key={session.session_id}
                session={session}
                isSelected={selectedSessionId === session.session_id}
                onClick={() => onSelectSession(session.session_id)}
                getStatusColor={getStatusColor}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionItemProps {
  session: Session;
  isSelected: boolean;
  onClick: () => void;
  getStatusColor: (status: string) => string;
}

const SessionItem = memo(function SessionItem({ session, isSelected, onClick, getStatusColor }: SessionItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-2 py-1.5 text-left rounded-lg transition-colors duration-200 flex items-center gap-2 ${
        isSelected
          ? 'glass-strong border-l-2 border-[var(--accent-primary)] pl-1.5 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]'
          : 'hover:glass border-l-2 border-transparent'
      }`}
    >
      {/* Status dot with glow */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(session.status)} ${
          session.status === 'active' ? 'status-active' : ''
        } ${session.status === 'idle' ? 'glow-warning' : ''}`}
      />

      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-xs font-medium truncate ${isSelected ? 'text-[var(--accent-primary)]' : ''}`}>
            {session.name || session.project_name}
          </span>
          {session.tmux_pane && (
            <span className="text-[10px] text-[var(--accent-secondary)] font-mono flex-shrink-0 opacity-70">
              {session.tmux_pane}
            </span>
          )}
        </div>
        {session.detected_task && (
          <div className="text-[10px] text-[var(--text-muted)] truncate">
            {session.detected_task}
          </div>
        )}
      </div>
    </button>
  );
});
