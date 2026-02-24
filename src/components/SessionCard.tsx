import { useState, useCallback, memo } from 'react';
import type { Session, FileConflict } from '../types/electron';
import { ConflictBadge } from './ConflictBadge';

interface SessionCardProps {
  session: Session;
  isSelected: boolean;
  onSelectSession: (sessionId: string) => void;
  conflicts?: FileConflict[];
  onRequestTmux?: (session: Session) => void;
}

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

/**
 * Individual session card showing:
 * - Status indicator (pulsing green for active)
 * - tmux location (ea-3:0.1)
 * - Detected task
 * - Area badge
 * - Recent tools
 * - Last activity
 */
export const SessionCard = memo(function SessionCard({ session, isSelected, onSelectSession, conflicts = [], onRequestTmux }: SessionCardProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(() => {
    onSelectSession(session.session_id);
  }, [onSelectSession, session.session_id]);

  const handleCopyResumeCommand = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const cmd = `claude --resume ${session.session_id} --dangerously-skip-permissions`;
    await navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [session.session_id]);

  const handleOpenTerminal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRequestTmux?.(session);
  }, [onRequestTmux, session]);

  const getTmuxLocation = () => {
    if (session.tmux_session && session.tmux_pane) {
      return `${session.tmux_session}:${session.tmux_pane}`;
    }
    return null;
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full p-4 text-left rounded-xl glass hover-lift transition-colors duration-200 ${
        isSelected
          ? 'border-gradient ring-1 ring-[var(--accent-primary)]/30'
          : 'border border-[var(--border)] hover:border-[var(--border-accent)]'
      }`}
    >
      {/* Header with status and project name */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${getStatusColor(session.status)} ${
              session.status === 'active' ? 'status-active' : ''
            } ${session.status === 'idle' ? 'glow-warning' : ''}`}
          />
          <span className="font-medium truncate max-w-[160px]">
            {session.name || session.project_name}
          </span>
          {conflicts.length > 0 && <ConflictBadge conflicts={conflicts} compact />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyResumeCommand}
            className={`p-1.5 rounded transition-colors ${
              copied
                ? 'text-[var(--success)]'
                : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title={copied ? 'Copied!' : 'Copy resume command'}
          >
            {copied ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
          <button
            onClick={handleOpenTerminal}
            className="p-1.5 rounded transition-colors hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="Open in Terminal"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            {formatTime(session.last_activity)}
          </span>
        </div>
      </div>

      {/* tmux location with liveness indicator */}
      {getTmuxLocation() ? (
        <div className="mb-2 flex items-center gap-2">
          {/* Tmux liveness indicator */}
          <span
            className={`w-2 h-2 rounded-full ${
              session.tmux_alive === true
                ? 'bg-[var(--success)] status-active'
                : 'bg-gray-500'
            }`}
            title={
              session.tmux_alive === true
                ? 'Claude running in tmux'
                : session.tmux_alive === false
                ? 'Pane exists but Claude not running'
                : 'Tmux status unknown'
            }
          />
          <span className="text-xs font-mono px-2 py-0.5 glass-subtle rounded-lg text-[var(--accent-secondary)]">
            {getTmuxLocation()}
          </span>
        </div>
      ) : session.status !== 'completed' ? (
        <div className="mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-xs text-[var(--text-muted)]">No active tmux pane</span>
        </div>
      ) : null}

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
            <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-[var(--accent-primary)]/30 rounded-full text-[var(--accent-primary)]">
              {session.detected_area}
            </span>
          )}
          {session.tags && (
            <span className="text-xs text-[var(--text-muted)]">
              {session.tags.split(',').slice(0, 2).join(', ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span title="Messages" className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {session.message_count}
          </span>
          <span title="Tool calls" className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {session.tool_call_count}
          </span>
        </div>
      </div>

      {/* Git branch */}
      {session.git_branch && (
        <div className="mt-2 text-xs text-[var(--text-muted)] flex items-center gap-1">
          <svg className="w-3 h-3 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="font-mono">{session.git_branch}</span>
        </div>
      )}
    </button>
  );
});
