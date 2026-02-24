import type { Session } from '../../types/electron';

interface RelatedSessionsProps {
  sessions: Session[];
  isLoading: boolean;
  onSelectSession: (sessionId: string) => void;
}

/**
 * List of sessions related to the current session (by shared files)
 */
export function RelatedSessions({
  sessions,
  isLoading,
  onSelectSession,
}: RelatedSessionsProps) {
  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return 'bg-[var(--success)]';
      case 'idle':
        return 'bg-[var(--warning)]';
      case 'completed':
        return 'bg-gray-500';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month} ${day}, ${hours}:${minutes}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 bg-[var(--bg-tertiary)] rounded-md animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-xs text-[var(--text-secondary)] opacity-50">
        No related sessions
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {sessions.map((session) => (
        <button
          key={session.session_id}
          onClick={() => onSelectSession(session.session_id)}
          className="w-full p-2 text-left rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--border)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${getStatusColor(session.status)} ${
                session.status === 'active' ? 'status-active' : ''
              }`}
            />
            <span className="flex-1 text-xs font-medium truncate">
              {session.name || session.project_name}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {formatTime(session.last_activity)}
            </span>
          </div>
          {session.detected_task && (
            <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5 pl-4">
              {session.detected_task}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
