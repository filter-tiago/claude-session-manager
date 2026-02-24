import type { LedgerStatus } from '../../types/electron';

interface LedgerStatusBadgeProps {
  status: LedgerStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<
  LedgerStatus,
  { label: string; bgColor: string; textColor: string; dotColor: string }
> = {
  active: {
    label: 'Active',
    bgColor: 'bg-[var(--success)]/20',
    textColor: 'text-[var(--success)]',
    dotColor: 'bg-[var(--success)]',
  },
  stale: {
    label: 'Stale',
    bgColor: 'bg-[var(--warning)]/20',
    textColor: 'text-[var(--warning)]',
    dotColor: 'bg-[var(--warning)]',
  },
  completed: {
    label: 'Done',
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
    dotColor: 'bg-gray-500',
  },
};

export function LedgerStatusBadge({
  status,
  size = 'sm',
}: LedgerStatusBadgeProps) {
  const config = statusConfig[status];

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.textColor} ${sizeClasses}`}
    >
      <span className={`${dotSize} rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}
