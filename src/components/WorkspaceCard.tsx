import { useState } from 'react';
import type { WorkspaceWithStats } from '../types/electron';

interface WorkspaceCardProps {
  workspace: WorkspaceWithStats;
  isSelected: boolean;
  onSelect: () => void;
  onAttach: () => void;
  onComplete: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

export function WorkspaceCard({
  workspace,
  isSelected,
  onSelect,
  onAttach,
  onComplete,
  onRestore,
  onDelete,
}: WorkspaceCardProps) {
  const [showActions, setShowActions] = useState(false);
  const isActive = workspace.status === 'active';

  // Format project path to show just the last directory
  const shortProjectPath = workspace.project_path.split('/').pop() || workspace.project_path;

  // Format relative time
  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'just now';
  };

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`group relative p-4 rounded-lg border transition-colors duration-200 cursor-pointer ${
        isSelected
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 glow-accent'
          : 'border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
      }`}
    >
      {/* Status indicator */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isActive
                ? 'bg-[var(--success)] status-active'
                : 'bg-gray-500'
            }`}
          />
          <h3 className="font-medium text-[var(--text-primary)] truncate max-w-[180px]">
            {workspace.name}
          </h3>
        </div>

        {/* Quick action buttons - show on hover */}
        {showActions && (
          <div className="flex items-center gap-1 animate-fade-in">
            {isActive ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAttach();
                  }}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                  title="Attach to tmux session"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onComplete();
                  }}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--success)] transition-colors"
                  title="Mark as complete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--warning)] transition-colors"
                title="Restore tmux session"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete workspace "${workspace.name}"?`)) {
                  onDelete();
                }
              }}
              className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors"
              title="Delete workspace"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Project path */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="truncate">{shortProjectPath}</span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span>{workspace.session_count} session{workspace.session_count !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span>{workspace.total_messages} msg{workspace.total_messages !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Description if present */}
      {workspace.description && (
        <p className="mt-2 text-xs text-[var(--text-muted)] line-clamp-2">
          {workspace.description}
        </p>
      )}

      {/* Timestamp */}
      <div className="mt-3 text-[10px] text-[var(--text-muted)]">
        {isActive ? (
          <>Created {formatRelativeTime(workspace.created_at)}</>
        ) : (
          <>Completed {formatRelativeTime(workspace.completed_at || workspace.created_at)}</>
        )}
      </div>

      {/* tmux session indicator */}
      {workspace.tmux_session && (
        <div className="absolute bottom-2 right-2 text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-primary)] px-1.5 py-0.5 rounded">
          {workspace.tmux_session}
        </div>
      )}
    </div>
  );
}
