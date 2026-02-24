import { useEffect, useCallback, useRef } from 'react';
import { useSessionStore, useFilteredSessions } from '../stores/sessionStore';
import type { Session, GetSessionsOptions } from '../types/electron';

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

const DASHBOARD_PAGE_SIZE = 200;

function normalizeSessionOptions(options?: GetSessionsOptions): GetSessionsOptions {
  const normalized: GetSessionsOptions = { ...(options ?? {}) };

  if (normalized.limit === undefined) {
    normalized.limit = DASHBOARD_PAGE_SIZE;
  }

  if ((normalized.limit ?? 0) > 0 && normalized.offset === undefined) {
    normalized.offset = 0;
  }

  return normalized;
}

function computeHasMore(data: Session[] | undefined, options: GetSessionsOptions): boolean {
  const limit = options.limit ?? 0;
  return limit > 0 && (data?.length ?? 0) === limit;
}

/**
 * Subscription hook — sets up IPC listeners and initial data load.
 * Call once at the App root. Does NOT return data.
 */
export function useSessionSubscription() {
  // Select only the action functions (stable references from create())
  const setSessions = useSessionStore((s) => s.setSessions);
  const setStats = useSessionStore((s) => s.setStats);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setLoadingMore = useSessionStore((s) => s.setLoadingMore);
  const setHasMoreSessions = useSessionStore((s) => s.setHasMoreSessions);
  const setFilterMode = useSessionStore((s) => s.setFilterMode);
  const setTotalCount = useSessionStore((s) => s.setTotalCount);
  const setError = useSessionStore((s) => s.setError);
  const updateSession = useSessionStore((s) => s.updateSession);
  const addSession = useSessionStore((s) => s.addSession);

  // Request ID for cancellation (prevents race conditions)
  const requestIdRef = useRef(0);

  // Load sessions with smart filtering (default)
  const loadSessions = useCallback(async (options?: GetSessionsOptions) => {
    const normalizedOptions = normalizeSessionOptions(options);
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);

    try {
      const [data, total] = await Promise.all([
        window.electronAPI?.getSessions(normalizedOptions),
        window.electronAPI?.getTotalSessionCount(),
      ]);

      // Check if this request is still the latest
      if (requestId !== requestIdRef.current) {
        console.log('[useSessions] Stale request ignored', requestId);
        return;
      }

      console.log('[useSessions] Got sessions:', data?.length ?? 0, 'of', total);

      if (data) {
        setSessions(data);
      }
      setHasMoreSessions(computeHasMore(data, normalizedOptions));
      if (total !== undefined) {
        setTotalCount(total);
      }

      // Update filter mode based on options
      if (normalizedOptions.showAll) {
        setFilterMode('all');
      } else {
        setFilterMode('smart');
      }
    } catch (err) {
      // Check if this request is still the latest
      if (requestId !== requestIdRef.current) return;

      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      console.error('[useSessions] Failed to load sessions:', message);
      setError(message);
    } finally {
      // Only update loading if this is still the latest request
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [setSessions, setLoading, setLoadingMore, setHasMoreSessions, setFilterMode, setTotalCount, setError]);

  // Load stats (debounced to prevent excessive calls)
  const loadStatsImmediate = useCallback(async () => {
    try {
      const data = await window.electronAPI?.getStats();
      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [setStats]);

  // Debounced version for real-time updates
  const loadStatsDebounced = useRef(debounce(loadStatsImmediate, 500)).current;

  // Initial load and subscriptions
  useEffect(() => {
    loadSessions();
    loadStatsImmediate();

    // Subscribe to real-time updates
    const unsubscribeUpdate = window.electronAPI?.onSessionUpdate(
      (session: Session) => {
        updateSession(session);
        loadStatsDebounced(); // Debounced to prevent excessive calls
      }
    );

    const unsubscribeCreate = window.electronAPI?.onSessionCreated(
      (session: Session) => {
        addSession(session);
        loadStatsDebounced(); // Debounced to prevent excessive calls
      }
    );

    // Refresh sessions and stats when full indexing completes
    const unsubscribeIndex = window.electronAPI?.onIndexComplete?.(() => {
      const { filterMode, filters } = useSessionStore.getState();
      void loadSessions({
        showAll: filterMode === 'all',
        projectPath: filters.project,
      });
      loadStatsImmediate();
    });

    return () => {
      unsubscribeUpdate?.();
      unsubscribeCreate?.();
      unsubscribeIndex?.();
    };
  }, [loadSessions, loadStatsImmediate, loadStatsDebounced, updateSession, addSession]);

  return { loadSessions, loadStatsImmediate };
}

/**
 * Data access hook — reads from the store via granular selectors.
 * Call from any component that needs session data. No IPC setup.
 *
 * Default behavior uses smart filtering:
 * - All active sessions (regardless of age)
 * - All sessions from last 24 hours
 * - Loaded in paged chunks to keep the UI responsive
 */
export function useSessions() {
  // Granular state selectors — each subscribes only to its slice
  const sessions = useSessionStore((s) => s.sessions);
  const stats = useSessionStore((s) => s.stats);
  const searchQuery = useSessionStore((s) => s.searchQuery);
  const filters = useSessionStore((s) => s.filters);
  const isLoading = useSessionStore((s) => s.isLoading);
  const isLoadingMore = useSessionStore((s) => s.isLoadingMore);
  const hasMoreSessions = useSessionStore((s) => s.hasMoreSessions);
  const filterMode = useSessionStore((s) => s.filterMode);
  const totalCount = useSessionStore((s) => s.totalCount);
  const error = useSessionStore((s) => s.error);

  // Actions — stable references from create(), no shallow needed
  const setSessions = useSessionStore((s) => s.setSessions);
  const appendSessions = useSessionStore((s) => s.appendSessions);
  const setStats = useSessionStore((s) => s.setStats);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setLoadingMore = useSessionStore((s) => s.setLoadingMore);
  const setHasMoreSessions = useSessionStore((s) => s.setHasMoreSessions);
  const setSearchQuery = useSessionStore((s) => s.setSearchQuery);
  const setFilters = useSessionStore((s) => s.setFilters);
  const setFilterMode = useSessionStore((s) => s.setFilterMode);
  const setTotalCount = useSessionStore((s) => s.setTotalCount);
  const setError = useSessionStore((s) => s.setError);
  const resetFilters = useSessionStore((s) => s.resetFilters);

  // Memoized filtered sessions from the standalone selector
  const filteredSessions = useFilteredSessions();

  // Request ID for cancellation (prevents race conditions)
  const requestIdRef = useRef(0);

  // Load sessions with smart filtering (default)
  const loadSessions = useCallback(async (options?: GetSessionsOptions) => {
    const normalizedOptions = normalizeSessionOptions(options);
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);

    try {
      const [data, total] = await Promise.all([
        window.electronAPI?.getSessions(normalizedOptions),
        window.electronAPI?.getTotalSessionCount(),
      ]);

      // Check if this request is still the latest
      if (requestId !== requestIdRef.current) {
        console.log('[useSessions] Stale request ignored', requestId);
        return;
      }

      console.log('[useSessions] Got sessions:', data?.length ?? 0, 'of', total);

      if (data) {
        setSessions(data);
      }
      setHasMoreSessions(computeHasMore(data, normalizedOptions));
      if (total !== undefined) {
        setTotalCount(total);
      }

      // Update filter mode based on options
      if (normalizedOptions.showAll) {
        setFilterMode('all');
      } else {
        setFilterMode('smart');
      }
    } catch (err) {
      // Check if this request is still the latest
      if (requestId !== requestIdRef.current) return;

      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      console.error('[useSessions] Failed to load sessions:', message);
      setError(message);
    } finally {
      // Only update loading if this is still the latest request
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [setSessions, setLoading, setLoadingMore, setHasMoreSessions, setFilterMode, setTotalCount, setError]);

  // Load all sessions (bypasses smart filtering)
  const loadAllSessions = useCallback(async () => {
    await loadSessions({ showAll: true, projectPath: filters.project });
  }, [loadSessions, filters.project]);

  // Apply project filter and reload from backend so pagination remains accurate
  const setProjectFilter = useCallback(async (projectPath: string | undefined) => {
    setFilters({ ...filters, project: projectPath });

    if (filterMode === 'search') {
      return;
    }

    await loadSessions({
      showAll: filterMode === 'all',
      projectPath,
    });
  }, [setFilters, filters, filterMode, loadSessions]);

  // Load the next page for the current mode (smart or all)
  const loadMoreSessions = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMoreSessions || filterMode === 'search') {
      return;
    }

    const options: GetSessionsOptions = {
      showAll: filterMode === 'all',
      limit: DASHBOARD_PAGE_SIZE,
      offset: sessions.length,
      projectPath: filters.project,
    };

    setLoadingMore(true);
    setError(null);

    try {
      const data = await window.electronAPI?.getSessions(options);
      if (data && data.length > 0) {
        appendSessions(data);
      }
      setHasMoreSessions(computeHasMore(data, options));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load more sessions';
      console.error('[useSessions] Failed to load more sessions:', message);
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  }, [
    isLoading,
    isLoadingMore,
    hasMoreSessions,
    filterMode,
    sessions.length,
    filters.project,
    setLoadingMore,
    setHasMoreSessions,
    appendSessions,
    setError,
  ]);

  // Load stats
  const loadStatsImmediate = useCallback(async () => {
    try {
      const data = await window.electronAPI?.getStats();
      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [setStats]);

  // Search sessions (searches ALL sessions, not just filtered)
  const search = useCallback(
    async (query: string) => {
      const requestId = ++requestIdRef.current;
      setSearchQuery(query);

      if (!query.trim()) {
        // Clear search, reload with smart filtering
        setFilterMode('smart');
        await loadSessions({ projectPath: filters.project });
        return;
      }

      setLoading(true);
      setLoadingMore(false);
      setHasMoreSessions(false);
      setError(null);

      try {
        // Search always queries all sessions
        const [results, total] = await Promise.all([
          window.electronAPI?.searchSessions(query),
          window.electronAPI?.getTotalSessionCount(),
        ]);

        // Check if this request is still the latest
        if (requestId !== requestIdRef.current) {
          console.log('[useSessions] Stale search request ignored', requestId);
          return;
        }

        if (results) {
          setSessions(results);
          setFilterMode('search');
        }
        if (total !== undefined) {
          setTotalCount(total);
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return;

        const message = err instanceof Error ? err.message : 'Search failed';
        console.error('Failed to search sessions:', message);
        setError(message);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [setSearchQuery, setSessions, setLoading, setLoadingMore, setHasMoreSessions, setFilterMode, setTotalCount, setError, loadSessions, filters.project]
  );

  // Trigger reindex
  const reindex = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI?.reindex();
      await loadSessions();
      await loadStatsImmediate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reindex failed';
      console.error('Failed to reindex:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, loadSessions, loadStatsImmediate]);

  // Reset to smart filtering (clears search AND filters)
  const resetToSmartFiltering = useCallback(async () => {
    resetFilters();
    await loadSessions();
  }, [loadSessions, resetFilters]);

  return {
    sessions,
    filteredSessions,
    stats,
    searchQuery,
    filters,
    isLoading,
    isLoadingMore,
    hasMoreSessions,
    error,
    search,
    setFilters,
    setProjectFilter,
    refresh: loadSessions,
    reindex,
    loadMoreSessions,
    // Smart filtering exports
    filterMode,
    totalCount,
    loadAllSessions,
    resetToSmartFiltering,
  };
}
