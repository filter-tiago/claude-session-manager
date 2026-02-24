import type { AISearchResult, AISearchMatch } from '../types/electron';

interface AISearchResultsProps {
  result: AISearchResult;
  onSelect: (match: AISearchMatch) => void;
  onClose: () => void;
}

function RelevanceBar({ score }: { score: number }) {
  // Score is 0-1, render as a small horizontal bar
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: 'var(--accent-gradient)',
          }}
        />
      </div>
      <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

function TypeIcon({ type }: { type: 'session' | 'ledger' }) {
  if (type === 'ledger') {
    return (
      <svg
        className="w-4 h-4 text-[var(--accent-secondary)] shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  }
  // session icon
  return (
    <svg
      className="w-4 h-4 text-[var(--accent-primary)] shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

export function AISearchResults({
  result,
  onSelect,
  onClose,
}: AISearchResultsProps) {
  const { matches, summary, durationMs, tier } = result;

  return (
    <div className="absolute top-full left-0 right-0 mt-1 z-50 glass-strong rounded-xl overflow-hidden animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <span className="text-xs text-[var(--text-secondary)] truncate">
          {summary}
        </span>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span
            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
              tier === 'ai'
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                : 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)]'
            }`}
          >
            {tier}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
            {durationMs}ms
          </span>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Match list */}
      {matches.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          No matches found
        </div>
      ) : (
        <ul className="max-h-72 overflow-y-auto">
          {matches.map((match, idx) => (
            <li key={`${match.type}-${match.id}-${idx}`}>
              <button
                onClick={() => onSelect(match)}
                className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors flex gap-2.5"
              >
                <TypeIcon type={match.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {match.title}
                    </span>
                    <RelevanceBar score={match.relevance} />
                  </div>
                  {match.projectName && (
                    <span className="text-[11px] text-[var(--text-muted)] block mt-0.5 truncate">
                      {match.projectName}
                    </span>
                  )}
                  <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                    {match.evidence}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
