import { useState, useCallback, memo } from 'react';
import type { Session, SessionStats } from '../types/electron';
import { SessionCard } from './SessionCard';
import { SessionCardSkeleton } from './ui';
import { TmuxNameDialog } from './modals/TmuxNameDialog';

type FilterMode = 'smart' | 'all' | 'search';

interface SessionGridProps {
  sessions: Session[];
  stats: SessionStats | null;
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  isLoading: boolean;
  // Smart filtering props
  filterMode?: FilterMode;
  totalCount?: number;
  onShowAll?: () => void;
  onLoadMore?: () => void;
  onResetFilter?: () => void;
  searchQuery?: string;
  hasMoreSessions?: boolean;
  isLoadingMore?: boolean;
  // Project filter props
  projects?: Array<{ project_path: string; project_name: string }>;
  selectedProject?: string;
  onProjectFilter?: (projectPath: string | undefined) => void;
}

/**
 * Main grid showing all sessions as cards
 * Displays stats at the top and a responsive grid of session cards
 */
export function SessionGrid({
  sessions,
  stats,
  selectedSessionId,
  onSelectSession,
  isLoading,
  filterMode = 'smart',
  totalCount = 0,
  onShowAll,
  onLoadMore,
  onResetFilter,
  searchQuery = '',
  hasMoreSessions = false,
  isLoadingMore = false,
  projects = [],
  selectedProject,
  onProjectFilter,
}: SessionGridProps) {
  // 3B: Hoisted TmuxNameDialog state — single instance instead of one per card
  const [tmuxDialogSession, setTmuxDialogSession] = useState<Session | null>(null);

  const handleRequestTmux = useCallback((session: Session) => {
    setTmuxDialogSession(session);
  }, []);

  const handleTmuxNameConfirm = useCallback(async (tmuxName: string) => {
    if (!tmuxDialogSession) return;
    setTmuxDialogSession(null);
    try {
      const result = await window.electronAPI.openSessionTerminal(tmuxDialogSession, tmuxName);
      if (!result.success) {
        console.error('Failed to open terminal:', result.error);
      }
    } catch (error) {
      console.error('Failed to open terminal:', error);
    }
  }, [tmuxDialogSession]);

  const handleTmuxDialogClose = useCallback(() => {
    setTmuxDialogSession(null);
  }, []);

  const generateDefaultTmuxName = useCallback((projectPath?: string): string => {
    if (!projectPath) return 'cc';
    const basename = projectPath.split('/').pop() || '';
    const segments = basename.split('-').filter(Boolean);
    if (segments.length === 0) return 'cc';
    return segments.map((s) => s.charAt(0)).join('');
  }, []);

  // Show filter indicator when using smart filtering and there are more sessions
  const showSmartFilterIndicator = filterMode === 'smart' && totalCount > sessions.length;

  // Show "back to recent" only when explicitly viewing all (not during search)
  const showBackToRecent = filterMode === 'all' && onResetFilter;

  // Show search results indicator during search
  const showSearchIndicator = filterMode === 'search' && searchQuery;

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      {/* Stats header - glass cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6 animate-fade-in">
          <StatCard
            label="Total Sessions"
            value={stats.total}
            color="var(--text-primary)"
            glowClass=""
          />
          <StatCard
            label="Active"
            value={stats.active}
            color="var(--success)"
            glowClass="glow-success"
          />
          <StatCard
            label="Idle"
            value={stats.idle}
            color="var(--warning)"
            glowClass="glow-warning"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            color="var(--text-secondary)"
            glowClass=""
          />
        </div>
      )}

      {/* Smart filter indicator */}
      {showSmartFilterIndicator && (
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="px-2 py-1 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
              Active + Last 24 hours
            </span>
            <span>• {sessions.length} of {totalCount} sessions</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Project filter dropdown */}
            {projects.length > 1 && onProjectFilter && (
              <select
                value={selectedProject || ''}
                onChange={(e) => onProjectFilter(e.target.value || undefined)}
                className="text-sm px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors appearance-none cursor-pointer pr-7"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2388929d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 6px center',
                }}
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.project_path} value={p.project_path}>
                    {p.project_name}
                  </option>
                ))}
              </select>
            )}
            {onShowAll && (
              <button
                onClick={onShowAll}
                className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors"
              >
                Show all →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Project filter when not showing smart filter indicator */}
      {!showSmartFilterIndicator && !showSearchIndicator && !showBackToRecent && projects.length > 1 && onProjectFilter && (
        <div className="flex items-center justify-end mb-4 px-1">
          <select
            value={selectedProject || ''}
            onChange={(e) => onProjectFilter(e.target.value || undefined)}
            className="text-sm px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors appearance-none cursor-pointer pr-7"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2388929d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
            }}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.project_path} value={p.project_path}>
                {p.project_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Search results indicator */}
      {showSearchIndicator && (
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="px-2 py-1 rounded-md bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
              Search results
            </span>
            <span>• {sessions.length} match{sessions.length !== 1 ? 'es' : ''} for "{searchQuery}"</span>
          </div>
          {onResetFilter && (
            <button
              onClick={onResetFilter}
              className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* "Back to recent" when showing all sessions */}
      {showBackToRecent && (
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="px-2 py-1 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
              All sessions
            </span>
            <span>• {sessions.length} sessions</span>
          </div>
          <button
            onClick={onResetFilter}
            className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors"
          >
            ← Back to recent
          </button>
        </div>
      )}

      {/* Sessions grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <SessionCardSkeleton />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center glass rounded-2xl p-8 animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-[var(--accent-primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-1 text-gradient">
              {filterMode === 'search' ? 'No matches found' : 'No sessions found'}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {filterMode === 'search'
                ? 'Try a different search term or clear the search.'
                : 'Sessions will appear here as Claude CLI sessions are detected.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session, index) => {
                const shouldAnimate = index < 9;
                return (
                  <div
                    key={session.session_id}
                    className={shouldAnimate ? 'animate-slide-up' : ''}
                    style={shouldAnimate ? { animationDelay: `${index * 50}ms` } : undefined}
                  >
                    <SessionCard
                      session={session}
                      isSelected={selectedSessionId === session.session_id}
                      onSelectSession={onSelectSession}
                      onRequestTmux={handleRequestTmux}
                    />
                  </div>
                );
              })}
            </div>

            {hasMoreSessions && onLoadMore && (
              <div className="flex justify-center pb-2">
                <button
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="text-sm px-4 py-2 rounded-lg border border-[var(--border)] glass hover:border-[var(--accent-primary)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoadingMore ? 'Loading more...' : 'Load more sessions'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3B: Single hoisted TmuxNameDialog instance */}
      <TmuxNameDialog
        isOpen={tmuxDialogSession !== null}
        onClose={handleTmuxDialogClose}
        onConfirm={handleTmuxNameConfirm}
        defaultName={generateDefaultTmuxName(tmuxDialogSession?.project_path)}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  glowClass?: string;
}

const StatCard = memo(function StatCard({ label, value, color, glowClass }: StatCardProps) {
  return (
    <div className={`p-4 glass rounded-xl hover-lift transition-colors duration-200 ${glowClass || ''}`}>
      <div className="text-3xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-sm text-[var(--text-muted)]">{label}</div>
    </div>
  );
});
