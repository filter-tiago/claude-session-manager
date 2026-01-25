import { useEffect, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import type { Session } from '../types/electron';

/**
 * Hook for loading and subscribing to sessions
 * Handles initial load, search, and real-time updates
 */
export function useSessions() {
  const {
    sessions,
    stats,
    searchQuery,
    filters,
    isLoading,
    setSessions,
    setStats,
    setLoading,
    setSearchQuery,
    setFilters,
    updateSession,
    addSession,
    getFilteredSessions,
  } = useSessionStore();

  // Load all sessions
  const loadSessions = useCallback(async () => {
    setLoading(true);
    console.log('[useSessions] Loading sessions...');
    console.log('[useSessions] electronAPI available:', !!window.electronAPI);
    try {
      const data = await window.electronAPI?.getSessions();
      console.log('[useSessions] Got sessions:', data?.length ?? 0);
      if (data) {
        setSessions(data);
      }
    } catch (error) {
      console.error('[useSessions] Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [setSessions, setLoading]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const data = await window.electronAPI?.getStats();
      if (data) {
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [setStats]);

  // Search sessions
  const search = useCallback(
    async (query: string) => {
      setSearchQuery(query);

      if (!query.trim()) {
        // Clear search, reload all sessions
        loadSessions();
        return;
      }

      setLoading(true);
      try {
        const results = await window.electronAPI?.searchSessions(query);
        if (results) {
          setSessions(results);
        }
      } catch (error) {
        console.error('Failed to search sessions:', error);
      } finally {
        setLoading(false);
      }
    },
    [setSearchQuery, setSessions, setLoading, loadSessions]
  );

  // Initial load and subscriptions
  useEffect(() => {
    loadSessions();
    loadStats();

    // Subscribe to real-time updates
    const unsubscribeUpdate = window.electronAPI?.onSessionUpdate(
      (session: Session) => {
        updateSession(session);
        loadStats(); // Refresh stats on updates
      }
    );

    const unsubscribeCreate = window.electronAPI?.onSessionCreated(
      (session: Session) => {
        addSession(session);
        loadStats(); // Refresh stats on new sessions
      }
    );

    return () => {
      unsubscribeUpdate?.();
      unsubscribeCreate?.();
    };
  }, [loadSessions, loadStats, updateSession, addSession]);

  // Trigger reindex
  const reindex = useCallback(async () => {
    setLoading(true);
    try {
      await window.electronAPI?.reindex();
      await loadSessions();
      await loadStats();
    } catch (error) {
      console.error('Failed to reindex:', error);
    } finally {
      setLoading(false);
    }
  }, [setLoading, loadSessions, loadStats]);

  return {
    sessions,
    filteredSessions: getFilteredSessions(),
    stats,
    searchQuery,
    filters,
    isLoading,
    search,
    setFilters,
    refresh: loadSessions,
    reindex,
  };
}
