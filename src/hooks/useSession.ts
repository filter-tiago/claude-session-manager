import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session, SessionEvent } from '../types/electron';

interface UseSessionResult {
  session: Session | null;
  events: SessionEvent[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasNewEvents: boolean;
}

// Reconciliation fallback interval (30 seconds) - IPC is primary update mechanism
const RECONCILIATION_INTERVAL_MS = 30000;
// Minimum time between IPC update and reconciliation poll (25 seconds)
const IPC_FRESHNESS_THRESHOLD_MS = 25000;

/**
 * Hook for loading a single session with its events.
 * Features:
 * - Initial load when session ID changes
 * - Subscribe to session updates via IPC (primary update mechanism)
 * - 30s reconciliation polling as fallback (skipped if IPC recently fired)
 * - Incremental event fetching (only fetches new events after initial load)
 * - hasNewEvents flag for UI indicators (ref-based, no extra re-renders)
 */
export function useSession(sessionId: string | null): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNewEvents, setHasNewEvents] = useState(false);

  // Track the highest event id we've seen for incremental fetching
  const lastEventIdRef = useRef<number>(0);
  // Track when IPC last delivered an update (to skip redundant polls)
  const lastIpcUpdateRef = useRef<number>(0);
  // Track previous event count for new event detection
  const prevEventCountRef = useRef<number>(0);

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setEvents([]);
      lastEventIdRef.current = 0;
      prevEventCountRef.current = 0;
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load session and events in parallel (full load on initial)
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
        prevEventCountRef.current = eventsData.length;
        // Track the highest event id for incremental fetching
        if (eventsData.length > 0) {
          lastEventIdRef.current = eventsData[eventsData.length - 1].id;
        }
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
    setHasNewEvents(false);
  }, [loadSession]);

  // Subscribe to updates for this session (primary update mechanism)
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = window.electronAPI?.onSessionUpdate((updated) => {
      if (updated.session_id === sessionId) {
        lastIpcUpdateRef.current = Date.now();

        // Only fetch events if message count actually changed
        const messageCountChanged = updated.message_count !== prevEventCountRef.current;

        if (messageCountChanged) {
          // Fetch only new events incrementally
          window.electronAPI?.getSessionEvents(sessionId, lastEventIdRef.current).then((newEventsData) => {
            if (newEventsData && newEventsData.length > 0) {
              // Update tracking refs
              lastEventIdRef.current = newEventsData[newEventsData.length - 1].id;
              prevEventCountRef.current += newEventsData.length;

              // Batch state update: session + events + hasNewEvents in minimal renders
              setSession(updated);
              setEvents(prev => [...prev, ...newEventsData]);
              setHasNewEvents(true);
            } else {
              // No new events despite count change - update session only
              setSession(updated);
            }
          });
        } else {
          // Message count unchanged - just update session metadata (status, etc.)
          setSession(updated);
        }
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [sessionId]);

  // Reconciliation fallback polling (30s, skipped if IPC recently fired)
  useEffect(() => {
    if (!sessionId || session?.status !== 'active') {
      return;
    }

    const reconcile = async () => {
      // Skip if IPC delivered an update recently
      if (Date.now() - lastIpcUpdateRef.current < IPC_FRESHNESS_THRESHOLD_MS) {
        return;
      }

      try {
        // Fetch only new events incrementally
        const newEvents = await window.electronAPI?.getSessionEvents(sessionId, lastEventIdRef.current);
        if (newEvents && newEvents.length > 0) {
          lastEventIdRef.current = newEvents[newEvents.length - 1].id;
          prevEventCountRef.current += newEvents.length;
          setEvents(prev => [...prev, ...newEvents]);
          setHasNewEvents(true);
        }

        // Also refresh session data (status, message counts, etc.)
        const sessionData = await window.electronAPI?.getSession(sessionId);
        if (sessionData) {
          setSession(sessionData);
        }
      } catch (err) {
        console.error('Failed to reconcile session events:', err);
      }
    };

    const interval = setInterval(reconcile, RECONCILIATION_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [sessionId, session?.status]);

  return {
    session,
    events,
    isLoading,
    error,
    refresh: loadSession,
    hasNewEvents,
  };
}
