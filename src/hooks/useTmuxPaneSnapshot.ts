import { useState, useCallback } from 'react';

interface UseSnapshotReturn {
  snapshots: Map<string, string>;
  captureSnapshot: (paneId: string, tmuxSession: string, tmuxPane: string) => Promise<void>;
  clearSnapshot: (paneId: string) => void;
  clearAll: () => void;
}

export function useTmuxPaneSnapshot(): UseSnapshotReturn {
  const [snapshots, setSnapshots] = useState<Map<string, string>>(new Map());

  const captureSnapshot = useCallback(async (paneId: string, tmuxSession: string, tmuxPane: string) => {
    try {
      const result = await window.electronAPI.capturePaneSnapshot(tmuxSession, tmuxPane);
      if (result.success && result.snapshot) {
        setSnapshots(prev => {
          const next = new Map(prev);
          next.set(paneId, result.snapshot!);
          return next;
        });
      }
    } catch {
      // Snapshot failed, leave empty
    }
  }, []);

  const clearSnapshot = useCallback((paneId: string) => {
    setSnapshots(prev => {
      const next = new Map(prev);
      next.delete(paneId);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSnapshots(new Map());
  }, []);

  return { snapshots, captureSnapshot, clearSnapshot, clearAll };
}
