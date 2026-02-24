import { useCallback } from 'react';
import type { TmuxSessionInfo } from '../types/electron';

interface TmuxSessionCardProps {
  session: TmuxSessionInfo;
  onKill: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onAttach: (name: string) => void;
}

/**
 * Formats an ISO timestamp to relative time (e.g., "2h ago", "3d ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Card component for a single tmux session.
 * Shows session name, status, window/pane counts, linked Claude sessions, and actions.
 */
export function TmuxSessionCard({ session, onKill, onRename, onAttach }: TmuxSessionCardProps) {
  const handleAttach = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAttach(session.name);
  }, [session.name, onAttach]);

  const handleKill = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Kill tmux session "${session.name}"? This will terminate all panes.`)) {
      onKill(session.name);
    }
  }, [session.name, onKill]);

  const handleRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = window.prompt(`Rename tmux session "${session.name}" to:`, session.name);
    if (newName && newName !== session.name) {
      onRename(session.name, newName);
    }
  }, [session.name, onRename]);

  return (
    <div className="p-4 rounded-xl glass hover-lift transition-colors duration-200 border border-[var(--border)] hover:border-[var(--border-accent)]">
      {/* Header: name + status dot */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              session.attached
                ? 'bg-[var(--success)] status-active'
                : 'bg-gray-500'
            }`}
            title={session.attached ? 'Attached' : 'Detached'}
          />
          <span className="font-medium text-[var(--text-primary)] truncate max-w-[180px]">
            {session.name}
          </span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            session.attached
              ? 'bg-[var(--success)]/20 text-[var(--success)]'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {session.attached ? 'attached' : 'detached'}
        </span>
      </div>

      {/* Body: stats */}
      <div className="space-y-2 mb-3">
        {/* Windows / panes */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <svg className="w-3.5 h-3.5 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
          </svg>
          <span>
            {session.windows} {session.windows === 1 ? 'window' : 'windows'},{' '}
            {session.panes} {session.panes === 1 ? 'pane' : 'panes'}
          </span>
        </div>

        {/* Linked Claude sessions */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <svg className="w-3.5 h-3.5 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {session.claudeSessions.length === 0 ? (
            <span className="text-[var(--text-muted)]">No linked sessions</span>
          ) : session.claudeSessions.length <= 3 ? (
            <span className="truncate">
              {session.claudeSessions.map((s) => s.substring(0, 8)).join(', ')}
            </span>
          ) : (
            <span>{session.claudeSessions.length} Claude sessions</span>
          )}
        </div>

        {/* Size */}
        {session.size && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span>{session.size}</span>
          </div>
        )}
      </div>

      {/* Footer: created time + actions */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
        <span className="text-xs text-[var(--text-muted)]">
          Created {formatRelativeTime(session.created)}
        </span>
        <div className="flex items-center gap-1">
          {/* Attach button */}
          <button
            onClick={handleAttach}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
            title="Attach to session"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Rename button */}
          <button
            onClick={handleRename}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition-colors"
            title="Rename session"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>

          {/* Kill button */}
          <button
            onClick={handleKill}
            className="p-1.5 rounded-lg hover:bg-[var(--error)]/20 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
            title="Kill session"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
