import { useState, useRef, useEffect, useCallback } from 'react';
import { useAISearch } from '../hooks/useAISearch';
import { AISearchResults } from './AISearchResults';
import type { AISearchMatch } from '../types/electron';

interface AISearchBarProps {
  onSelect?: (match: AISearchMatch) => void;
}

export function AISearchBar({ onSelect }: AISearchBarProps) {
  const { results, isSearching, error, projects, search, clearResults } =
    useAISearch();

  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show dropdown when results arrive
  useEffect(() => {
    if (results && results.matches.length >= 0) {
      setIsOpen(true);
    }
  }, [results]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      if (value.length >= 3) {
        search(value, projectFilter);
      } else {
        clearResults();
        setIsOpen(false);
      }
    },
    [search, clearResults, projectFilter]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        clearResults();
        setIsOpen(false);
        inputRef.current?.blur();
      } else if (e.key === 'Enter' && query.length >= 3) {
        // Immediate search (bypass debounce)
        search(query, projectFilter);
      }
    },
    [query, projectFilter, search, clearResults]
  );

  const handleProjectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value || undefined;
      setProjectFilter(value);
      if (query.length >= 3) {
        search(query, value);
      }
    },
    [query, search]
  );

  const handleSelect = useCallback(
    (match: AISearchMatch) => {
      setIsOpen(false);
      onSelect?.(match);
    },
    [onSelect]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    clearResults();
  }, [clearResults]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2">
        {/* AI badge */}
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)]">
          AI
        </span>

        {/* Search input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search sessions with AI..."
            className="w-full px-3 py-1.5 text-sm rounded-lg input-glass text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
          {/* Loading spinner */}
          {isSearching && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <svg
                className="w-4 h-4 text-[var(--accent-primary)] animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Project filter dropdown */}
        {projects.length > 0 && (
          <select
            value={projectFilter ?? ''}
            onChange={handleProjectChange}
            className="text-xs px-2 py-1.5 rounded-lg input-glass text-[var(--text-secondary)] bg-[var(--bg-secondary)] cursor-pointer max-w-[140px] truncate"
          >
            <option value="">All projects</option>
            {projects.map((p) => {
              const name = p.split('/').pop() || p;
              return (
                <option key={p} value={p}>
                  {name}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-1 text-xs text-[var(--error)] px-1">{error}</div>
      )}

      {/* Results dropdown */}
      {isOpen && results && (
        <AISearchResults
          result={results}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
