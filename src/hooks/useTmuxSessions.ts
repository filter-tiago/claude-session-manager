import { useState, useEffect, useCallback, useRef } from 'react';
import type { TmuxSessionInfo } from '../types/electron';

export function useTmuxSessions() {
  const [sessions, setSessions] = useState<TmuxSessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const result = await window.electronAPI.getTmuxSessions();
      setSessions(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tmux sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount, refresh every 10s (visibility-aware)
  useEffect(() => {
    loadSessions();
    intervalRef.current = setInterval(() => {
      if (!document.hidden) loadSessions();
    }, 10000);

    // Immediately refresh when tab becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadSessions();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadSessions]);

  const killSession = useCallback(async (name: string) => {
    const ok = await window.electronAPI.killTmuxSession(name);
    if (ok) await loadSessions(); // Refresh
    return ok;
  }, [loadSessions]);

  const renameSession = useCallback(async (oldName: string, newName: string) => {
    const ok = await window.electronAPI.renameTmuxSession(oldName, newName);
    if (ok) await loadSessions();
    return ok;
  }, [loadSessions]);

  const attachSession = useCallback(async (name: string) => {
    return window.electronAPI.attachTmuxSession(name);
  }, []);

  return { sessions, loading, error, killSession, renameSession, attachSession, refresh: loadSessions };
}
