import { useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import type { Ledger } from '../../types/electron';
import { Skeleton } from '../ui';

interface LedgersBrowserProps {
  onSelectLedger?: (ledger: Ledger) => void;
  selectedLedgerPath?: string;
}

export function LedgersBrowser({ onSelectLedger, selectedLedgerPath }: LedgersBrowserProps) {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadLedgers();
  }, []);

  const loadLedgers = async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.getLedgers();
      setLedgers(result);
    } catch (error) {
      console.error('Failed to load ledgers:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
            Ledgers
          </span>
        </div>
        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
          {ledgers.length}
        </span>
      </button>

      {/* Ledger list */}
      {isExpanded && (
        <div className="px-2">
          {isLoading ? (
            <div className="space-y-1 py-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-2 py-1.5 flex items-center gap-1.5">
                  <Skeleton variant="rectangular" width={14} height={14} className="rounded flex-shrink-0" />
                  <div className="flex-1">
                    <Skeleton variant="text" width="80%" height={12} className="mb-1" />
                    <Skeleton variant="text" width="60%" height={10} />
                  </div>
                </div>
              ))}
            </div>
          ) : ledgers.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--text-secondary)]">No ledgers found</div>
          ) : (
            <div className="space-y-0.5">
              {ledgers.slice(0, 5).map((ledger) => (
                <LedgerItem
                  key={ledger.path}
                  ledger={ledger}
                  isSelected={selectedLedgerPath === ledger.path}
                  onClick={() => onSelectLedger?.(ledger)}
                />
              ))}
              {/* View All link */}
              {ledgers.length > 0 && (
                <Link
                  to="/ledgers"
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

interface LedgerItemProps {
  ledger: Ledger;
  isSelected: boolean;
  onClick: () => void;
}

const LedgerItem = memo(function LedgerItem({ ledger, isSelected, onClick }: LedgerItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-2 py-1.5 text-left rounded transition-colors ${
        isSelected
          ? 'bg-[var(--bg-tertiary)] border-l-2 border-[var(--purple)] pl-1.5'
          : 'hover:bg-[var(--bg-tertiary)] border-l-2 border-transparent'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {/* Ledger icon */}
        <svg
          className="w-3.5 h-3.5 text-[var(--purple)] flex-shrink-0"
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
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{ledger.name}</div>
          {ledger.currentPhase && (
            <div className="text-[10px] text-[var(--text-secondary)] truncate">
              {ledger.currentPhase}
            </div>
          )}
        </div>
      </div>
    </button>
  );
});
