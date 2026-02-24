import { useState } from 'react';
import type { EnhancedLedger } from '../../types/electron';
import { LedgerStatusBadge } from './LedgerStatusBadge';
import { LedgerProgressBar } from './LedgerProgressBar';
import { LedgerQuickActions } from './LedgerQuickActions';

interface LedgerCardProps {
  ledger: EnhancedLedger;
  isSelected?: boolean;
  onSelect: () => void;
  onResume: () => void;
  onEdit: () => void;
  onView: () => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function LedgerCard({
  ledger,
  isSelected,
  onSelect,
  onResume,
  onEdit,
  onView,
}: LedgerCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative p-4 rounded-xl cursor-pointer transition-colors duration-200
        border border-[var(--border)] bg-[var(--bg-secondary)]
        hover:border-[var(--accent-primary)]/50 hover:shadow-lg
        ${isSelected ? 'border-[var(--accent-primary)] glow-accent' : ''}
      `}
    >
      {/* Header: Name + Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-[var(--text-primary)] truncate flex-1">
          {ledger.name}
        </h3>
        <LedgerStatusBadge status={ledger.status} />
      </div>

      {/* Goal (2 lines max) */}
      {ledger.goal && (
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3">
          {ledger.goal}
        </p>
      )}

      {/* Current Phase */}
      {ledger.currentPhase && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-medium text-[var(--purple)] uppercase">
            Now:
          </span>
          <span className="text-xs text-[var(--text-primary)] truncate">
            {ledger.currentPhase}
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-3">
        <LedgerProgressBar progress={ledger.progress} />
      </div>

      {/* Footer: Project + Time */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span className="truncate max-w-[60%]">{ledger.projectName}</span>
        <span>{formatRelativeTime(ledger.lastModified)}</span>
      </div>

      {/* Open Questions Indicator */}
      {ledger.hasOpenQuestions && (
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--warning)]"
          title="Has open questions"
        />
      )}

      {/* Quick Actions (shown on hover) */}
      <div
        className={`
          absolute bottom-4 right-4 transition-opacity duration-200
          ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <LedgerQuickActions
          onResume={onResume}
          onEdit={onEdit}
          onView={onView}
        />
      </div>
    </div>
  );
}
