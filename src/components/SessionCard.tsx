import type { Session } from '../types/electron';

interface SessionCardProps {
  session: Session;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Individual session card showing:
 * - Status indicator (pulsing green for active)
 * - tmux location (ea-3:0.1)
 * - Detected task
 * - Area badge
 * - Recent tools
 * - Last activity
 */
export function SessionCard({ session, isSelected, onClick }: SessionCardProps) {
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
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getTmuxLocation = () => {
    if (session.tmux_session && session.tmux_pane) {
      return `${session.tmux_session}:${session.tmux_pane}`;
    }
    return null;
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 text-left rounded-lg border transition-all duration-200 hover:scale-[1.02] ${
        isSelected
          ? 'bg-[var(--bg-tertiary)] border-[var(--accent-primary)]'
          : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--text-secondary)]'
      }`}
    >
      {/* Header with status and project name */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${getStatusColor(session.status)} ${
              session.status === 'active' ? 'status-active' : ''
            }`}
          />
          <span className="font-medium truncate max-w-[180px]">
            {session.name || session.project_name}
          </span>
        </div>
        <span className="text-xs text-[var(--text-secondary)]">
          {formatTime(session.last_activity)}
        </span>
      </div>

      {/* tmux location */}
      {getTmuxLocation() && (
        <div className="mb-2">
          <span className="text-xs font-mono px-2 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--text-secondary)]">
            {getTmuxLocation()}
          </span>
        </div>
      )}

      {/* Detected task */}
      {session.detected_task && (
        <p className="text-sm text-[var(--text-secondary)] mb-2 line-clamp-2">
          {session.detected_task}
        </p>
      )}

      {/* Bottom row: area badge and stats */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {session.detected_area && (
            <span className="text-xs px-2 py-0.5 bg-[var(--accent-secondary)] rounded-full text-[var(--text-primary)]">
              {session.detected_area}
            </span>
          )}
          {session.tags && (
            <span className="text-xs text-[var(--text-secondary)]">
              {session.tags.split(',').slice(0, 2).join(', ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span title="Messages">{session.message_count} msgs</span>
          <span title="Tool calls">{session.tool_call_count} tools</span>
        </div>
      </div>

      {/* Git branch */}
      {session.git_branch && (
        <div className="mt-2 text-xs text-[var(--text-secondary)]">
          <span className="font-mono">{session.git_branch}</span>
        </div>
      )}
    </button>
  );
}
