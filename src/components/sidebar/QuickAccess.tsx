interface QuickAccessProps {
  onNavigate?: (section: string) => void;
}

export function QuickAccess({ onNavigate }: QuickAccessProps) {
  const items = [
    { id: 'plans', label: 'Plans', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'handoffs', label: 'Handoffs', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
    { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <div className="flex flex-col border-t border-[var(--border)]">
      <div className="px-3 py-2">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Quick Access
        </span>
      </div>
      <div className="px-2 pb-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className="w-full px-2 py-1.5 text-left rounded transition-colors hover:bg-[var(--bg-tertiary)] flex items-center gap-2 opacity-50 cursor-not-allowed"
            disabled
            title="Coming in Sprint 3"
          >
            <svg
              className="w-3.5 h-3.5 text-[var(--text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={item.icon}
              />
            </svg>
            <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
