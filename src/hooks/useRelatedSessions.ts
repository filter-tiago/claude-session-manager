import { useState, useEffect, useCallback } from 'react';
import type { Session } from '../types/electron';

/**
 * Hook to fetch sessions related to a given session (by shared files)
 */
export function useRelatedSessions(sessionId: string | null) {
  const [relatedSessions, setRelatedSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRelatedSessions = useCallback(async () => {
    if (!sessionId) {
      setRelatedSessions([]);
      return;
    }

    setIsLoading(true);
    try {
      const sessions = await window.electronAPI.getRelatedSessions(sessionId);
      setRelatedSessions(sessions);
    } catch (error) {
      console.error('Failed to fetch related sessions:', error);
      setRelatedSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Fetch when sessionId changes
  useEffect(() => {
    fetchRelatedSessions();
  }, [fetchRelatedSessions]);

  return {
    relatedSessions,
    isLoading,
    refresh: fetchRelatedSessions,
  };
}
