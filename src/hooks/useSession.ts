import { useState, useEffect, useCallback } from 'react';
import type { Session, SessionEvent } from '../types/electron';

interface UseSessionResult {
  session: Session | null;
  events: SessionEvent[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for loading a single session with its events
 */
export function useSession(sessionId: string | null): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load session and events in parallel
      const [sessionData, eventsData] = await Promise.all([
        window.electronAPI?.getSession(sessionId),
        window.electronAPI?.getSessionEvents(sessionId),
      ]);

      if (sessionData) {
        setSession(sessionData);
      } else {
        setError('Session not found');
      }

      if (eventsData) {
        setEvents(eventsData);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Load session when ID changes
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Subscribe to updates for this session
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = window.electronAPI?.onSessionUpdate((updated) => {
      if (updated.session_id === sessionId) {
        setSession(updated);
        // Reload events when session updates
        window.electronAPI?.getSessionEvents(sessionId).then((eventsData) => {
          if (eventsData) {
            setEvents(eventsData);
          }
        });
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [sessionId]);

  return {
    session,
    events,
    isLoading,
    error,
    refresh: loadSession,
  };
}
