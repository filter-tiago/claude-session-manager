import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FileConflict } from '../types/electron';

/**
 * Hook to track file conflicts across active/idle sessions
 * Polls every 10 seconds for updates
 */
export function useFileConflicts() {
  const [conflicts, setConflicts] = useState<FileConflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConflicts = useCallback(async () => {
    try {
      const data = await window.electronAPI.getFileConflicts();
      setConflicts(data);
    } catch (error) {
      console.error('Failed to fetch file conflicts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchConflicts();

    const interval = setInterval(fetchConflicts, 10000);
    return () => clearInterval(interval);
  }, [fetchConflicts]);

  // Map of session ID to conflicting files
  const sessionConflictMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const conflict of conflicts) {
      for (const session of conflict.sessions) {
        const existing = map.get(session.session_id) || [];
        existing.push(conflict.file_path);
        map.set(session.session_id, existing);
      }
    }
    return map;
  }, [conflicts]);

  // Check if a session has any conflicts
  const hasConflicts = useCallback(
    (sessionId: string) => sessionConflictMap.has(sessionId),
    [sessionConflictMap]
  );

  // Get conflicts for a specific session
  const getSessionConflicts = useCallback(
    (sessionId: string): FileConflict[] => {
      const conflictingFiles = sessionConflictMap.get(sessionId);
      if (!conflictingFiles) return [];

      return conflicts.filter((c) =>
        conflictingFiles.includes(c.file_path)
      );
    },
    [conflicts, sessionConflictMap]
  );

  return {
    conflicts,
    isLoading,
    hasConflicts,
    getSessionConflicts,
    refresh: fetchConflicts,
  };
}
