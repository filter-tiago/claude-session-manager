import { useState, useEffect, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import type { TmuxSessionInfo } from '../../types/electron';
import { Skeleton } from '../ui';

interface TmuxBrowserProps {
  onAttachSession?: (name: string) => void;
}

export function TmuxBrowser({ onAttachSession }: TmuxBrowserProps) {
  const [sessions, setSessions] = useState<TmuxSessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.getTmuxSessions();
      // Sort by most recent activity
      const sorted = [...result].sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
      setSessions(sorted);
    } catch (error) {
      console.error('Failed to load tmux sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClickSession = useCallback(
    (name: string) => {
      if (onAttachSession) {
        onAttachSession(name);
      } else {
        // Fallback: use the electronAPI directly
        window.electronAPI.attachTmuxSession(name).catch((err) => {
          console.error('Failed to attach tmux session:', err);
        });
      }
    },
    [onAttachSession]
  );

  return (
    <div className="flex flex-col">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-2 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <svg
            className={`w-3 h-3 text-[var(--text-secondary)] transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Tmux Sessions
          </span>
        </div>
        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
          {sessions.length}
        </span>
      </button>

      {/* Session list */}
      {isExpanded && (
        <div className="px-2">
          {isLoading ? (
            <div className="space-y-1 py-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-2 py-1.5 flex items-center gap-1.5">
                  <Skeleton variant="rectangular" width={10} height={10} className="rounded-full flex-shrink-0" />
                  <div className="flex-1">
                    <Skeleton variant="text" width="70%" height={12} />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--text-secondary)]">No tmux sessions</div>
          ) : (
            <div className="space-y-0.5">
              {sessions.slice(0, 5).map((session) => (
                <TmuxSessionItem
                  key={session.name}
                  session={session}
                  onClick={() => handleClickSession(session.name)}
                />
              ))}
              {/* View All link */}
              {sessions.length > 0 && (
                <Link
                  to="/tmux"
                  className="w-full px-2 py-1.5 text-left rounded transition-colors hover:bg-[var(--bg-tertiary)] flex items-center justify-center gap-1 text-xs text-[var(--accent-primary)]"
                >
                  <span>View All</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TmuxSessionItemProps {
  session: TmuxSessionInfo;
  onClick: () => void;
}

const TmuxSessionItem = memo(function TmuxSessionItem({ session, onClick }: TmuxSessionItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full px-2 py-1.5 text-left rounded transition-colors hover:bg-[var(--bg-tertiary)] border-l-2 border-transparent"
      title={`${session.name} - ${session.windows}w/${session.panes}p${session.attached ? ' (attached)' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {/* Status dot */}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            session.attached
              ? 'bg-[var(--success)] status-active'
              : 'bg-gray-500'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{session.name}</div>
          <div className="text-[10px] text-[var(--text-muted)] truncate">
            {session.windows}w / {session.panes}p
            {session.claudeSessions.length > 0 && (
              <span className="text-[var(--accent-primary)]">
                {' '}
                &middot; {session.claudeSessions.length} claude
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});
