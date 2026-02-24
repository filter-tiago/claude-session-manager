import type { LedgerProgress } from '../../types/electron';

interface LedgerProgressBarProps {
  progress: LedgerProgress;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function LedgerProgressBar({
  progress,
  showLabel = true,
  size = 'sm',
}: LedgerProgressBarProps) {
  const { completed, total, percentage } = progress;

  if (total === 0) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={`flex-1 ${size === 'sm' ? 'h-1.5' : 'h-2'} rounded-full bg-[var(--bg-tertiary)]`}
        />
        {showLabel && (
          <span className="text-[10px] text-[var(--text-muted)]">No phases</span>
        )}
      </div>
    );
  }

  // Color based on percentage
  const getBarColor = () => {
    if (percentage === 100) return 'bg-[var(--success)]';
    if (percentage >= 50) return 'bg-[var(--accent-primary)]';
    return 'bg-[var(--accent-secondary)]';
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex-1 ${size === 'sm' ? 'h-1.5' : 'h-2'} rounded-full bg-[var(--bg-tertiary)] overflow-hidden`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
          {completed}/{total}
        </span>
      )}
    </div>
  );
}
