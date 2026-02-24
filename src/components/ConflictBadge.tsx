import { useState } from 'react';
import type { FileConflict } from '../types/electron';

interface ConflictBadgeProps {
  conflicts: FileConflict[];
  compact?: boolean;
}

/**
 * Badge showing file conflicts for a session
 * Compact mode shows just (!) icon
 * Expanded mode shows conflicting files list
 */
export function ConflictBadge({ conflicts, compact = true }: ConflictBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (conflicts.length === 0) return null;

  const fileCount = conflicts.length;

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="px-1.5 py-0.5 text-[10px] font-bold bg-[var(--warning)]/20 text-[var(--warning)] rounded-md border border-[var(--warning)]/30 hover:bg-[var(--warning)]/30 transition-colors"
          title={`${fileCount} file${fileCount > 1 ? 's' : ''} edited by multiple sessions`}
        >
          !
        </button>

        {/* Dropdown showing conflicting files */}
        {isExpanded && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
            />
            <div className="absolute right-0 top-full mt-1 z-50 w-64 p-2 glass rounded-lg shadow-lg animate-scale-in">
              <div className="text-[10px] font-semibold text-[var(--warning)] uppercase tracking-wider mb-1.5">
                Conflict Warning
              </div>
              <div className="text-xs text-[var(--text-secondary)] mb-2">
                {fileCount} file{fileCount > 1 ? 's' : ''} edited by multiple sessions:
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {conflicts.map((conflict) => (
                  <div
                    key={conflict.file_path}
                    className="text-xs font-mono bg-[var(--bg-tertiary)] rounded px-2 py-1"
                  >
                    <div className="text-[var(--text-primary)] truncate">
                      {conflict.file_path.split('/').pop()}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {conflict.sessions.length} sessions
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Expanded mode - shows full list inline
  return (
    <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-2">
      <div className="flex items-center gap-2 mb-2">
        <svg
          className="w-4 h-4 text-[var(--warning)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="text-xs font-medium text-[var(--warning)]">
          File Conflicts
        </span>
      </div>
      <div className="space-y-1">
        {conflicts.map((conflict) => (
          <div key={conflict.file_path} className="text-xs">
            <span className="font-mono text-[var(--text-primary)]">
              {conflict.file_path.split('/').pop()}
            </span>
            <span className="text-[var(--text-muted)] ml-2">
              ({conflict.sessions.length} sessions)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
