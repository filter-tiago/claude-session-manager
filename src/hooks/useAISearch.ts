import { useState, useCallback, useRef, useEffect } from 'react';
import type { AISearchResult, AISearchMatch } from '../types/electron';

export type { AISearchMatch };

export function useAISearch() {
  const [results, setResults] = useState<AISearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load distinct projects on mount for filter dropdown
  useEffect(() => {
    window.electronAPI
      .getDistinctProjectPaths()
      .then(setProjects)
      .catch((err) =>
        console.error('[AI Search] Failed to load projects:', err)
      );
  }, []);

  const search = useCallback((query: string, projectFilter?: string) => {
    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Min 3 chars
    if (query.length < 3) {
      setResults(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const result = await window.electronAPI.hybridSearch(
          query,
          projectFilter
        );
        setResults(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return { results, isSearching, error, projects, search, clearResults };
}
