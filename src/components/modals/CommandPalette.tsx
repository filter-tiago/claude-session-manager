import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Session, Ledger } from '../../types/electron';

interface CommandItem {
  id: string;
  label: string;
  category: 'action' | 'session' | 'ledger';
  icon: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  ledgers: Ledger[];
  onSelectSession: (sessionId: string) => void;
  onSelectLedger: (ledger: Ledger) => void;
  onNewSession: () => void;
  onRefresh: () => void;
  onReindex: () => void;
}

/**
 * Global command palette (⌘K) for quick navigation and actions
 */
export function CommandPalette({
  isOpen,
  onClose,
  sessions,
  ledgers,
  onSelectSession,
  onSelectLedger,
  onNewSession,
  onRefresh,
  onReindex,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command items
  const allItems = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      {
        id: 'action:new-session',
        label: 'New Session',
        category: 'action',
        icon: 'M12 4v16m8-8H4',
        action: onNewSession,
        keywords: ['create', 'spawn', 'start'],
      },
      {
        id: 'action:refresh',
        label: 'Refresh Sessions',
        category: 'action',
        icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
        action: onRefresh,
        keywords: ['reload', 'update'],
      },
      {
        id: 'action:reindex',
        label: 'Reindex All Sessions',
        category: 'action',
        icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
        action: onReindex,
        keywords: ['database', 'rebuild'],
      },
    ];

    const sessionItems: CommandItem[] = sessions.slice(0, 20).map((session) => ({
      id: `session:${session.session_id}`,
      label: session.name || session.project_name,
      category: 'session',
      icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      action: () => onSelectSession(session.session_id),
      keywords: [
        session.project_name.toLowerCase(),
        session.detected_task?.toLowerCase() || '',
        session.detected_area?.toLowerCase() || '',
        session.status,
      ].filter(Boolean),
    }));

    const ledgerItems: CommandItem[] = ledgers.slice(0, 10).map((ledger) => ({
      id: `ledger:${ledger.path}`,
      label: ledger.name,
      category: 'ledger',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      action: () => onSelectLedger(ledger),
      keywords: [
        ledger.name.toLowerCase(),
        ledger.goal?.toLowerCase() || '',
        ledger.currentPhase?.toLowerCase() || '',
      ].filter(Boolean),
    }));

    return [...actions, ...sessionItems, ...ledgerItems];
  }, [sessions, ledgers, onNewSession, onRefresh, onReindex, onSelectSession, onSelectLedger]);

  // Filter items by query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;

    const lowerQuery = query.toLowerCase();
    return allItems.filter((item) => {
      if (item.label.toLowerCase().includes(lowerQuery)) return true;
      if (item.keywords?.some((kw) => kw.includes(lowerQuery))) return true;
      return false;
    });
  }, [allItems, query]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      action: [],
      session: [],
      ledger: [],
    };

    for (const item of filteredItems) {
      groups[item.category].push(item);
    }

    return groups;
  }, [filteredItems]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            filteredItems[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredItems, selectedIndex, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'action':
        return 'Actions';
      case 'session':
        return 'Sessions';
      case 'ledger':
        return 'Ledgers';
      default:
        return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'action':
        return 'text-[var(--accent-primary)]';
      case 'session':
        return 'text-[var(--accent-secondary)]';
      case 'ledger':
        return 'text-[var(--purple)]';
      default:
        return 'text-[var(--text-secondary)]';
    }
  };

  let globalIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed inset-0 flex items-start justify-center pt-[15vh] z-50 pointer-events-none">
        <div
          className="w-full max-w-lg glass rounded-xl shadow-2xl overflow-hidden animate-scale-in pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <svg
              className="w-5 h-5 text-[var(--text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search sessions, ledgers, or actions..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            <kbd className="px-2 py-0.5 text-[10px] font-mono bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                No results found
              </div>
            ) : (
              Object.entries(groupedItems).map(([category, items]) => {
                if (items.length === 0) return null;

                return (
                  <div key={category} className="mb-2">
                    <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {getCategoryLabel(category)}
                    </div>
                    {items.map((item) => {
                      const itemIndex = globalIndex++;
                      const isSelected = itemIndex === selectedIndex;

                      return (
                        <button
                          key={item.id}
                          data-index={itemIndex}
                          onClick={() => {
                            item.action();
                            onClose();
                          }}
                          className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${
                            isSelected
                              ? 'bg-[var(--bg-tertiary)]'
                              : 'hover:bg-[var(--bg-tertiary)]/50'
                          }`}
                        >
                          <svg
                            className={`w-4 h-4 ${getCategoryColor(item.category)}`}
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
                          <span className="flex-1 text-sm text-[var(--text-primary)] truncate">
                            {item.label}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] text-[var(--text-muted)]">
                              Press Enter
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">Enter</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
