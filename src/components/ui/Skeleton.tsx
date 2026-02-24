interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
}

/**
 * Skeleton loading placeholder with pulse animation
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
}: SkeletonProps) {
  const baseClasses = 'bg-[var(--bg-tertiary)] animate-pulse';

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const defaultSizes = {
    text: { width: '100%', height: '1em' },
    circular: { width: '40px', height: '40px' },
    rectangular: { width: '100%', height: '100px' },
  };

  const style: React.CSSProperties = {
    width: width ?? defaultSizes[variant].width,
    height: height ?? defaultSizes[variant].height,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

/**
 * Pre-built skeleton for session cards
 */
export function SessionCardSkeleton() {
  return (
    <div className="p-4 rounded-xl glass border border-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" width={10} height={10} />
          <Skeleton variant="text" width={140} height={16} />
        </div>
        <Skeleton variant="text" width={40} height={12} />
      </div>

      {/* Task description */}
      <Skeleton variant="text" width="90%" height={14} className="mb-2" />
      <Skeleton variant="text" width="70%" height={14} className="mb-3" />

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <Skeleton variant="rectangular" width={60} height={20} className="rounded-full" />
        <div className="flex items-center gap-3">
          <Skeleton variant="text" width={30} height={12} />
          <Skeleton variant="text" width={30} height={12} />
        </div>
      </div>
    </div>
  );
}

/**
 * Pre-built skeleton for conversation messages
 */
export function MessageSkeleton({ isAssistant = false }: { isAssistant?: boolean }) {
  return (
    <div className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}>
      <Skeleton variant="circular" width={32} height={32} />
      <div className={`flex-1 max-w-[80%] ${isAssistant ? '' : 'flex flex-col items-end'}`}>
        <Skeleton variant="text" width="100%" height={14} className="mb-1" />
        <Skeleton variant="text" width="85%" height={14} className="mb-1" />
        <Skeleton variant="text" width="60%" height={14} />
      </div>
    </div>
  );
}

/**
 * Pre-built skeleton for related sessions
 */
export function RelatedSessionSkeleton() {
  return (
    <div className="p-2 rounded-md bg-[var(--bg-tertiary)]">
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" width={8} height={8} />
        <Skeleton variant="text" width="60%" height={12} />
        <Skeleton variant="text" width={20} height={10} className="ml-auto" />
      </div>
    </div>
  );
}
