import { useCallback, useEffect, useMemo } from 'react';
import { useLedgerStore, useFilteredLedgers, useSelectedLedger, useSelectedProject } from '../stores/ledgerStore';
import type { Ledger } from '../types/electron';

export function useLedgers() {
  // Granular state selectors
  const ledgers = useLedgerStore((s) => s.ledgers);
  const projects = useLedgerStore((s) => s.projects);
  const selectedLedgerPath = useLedgerStore((s) => s.selectedLedgerPath);
  const selectedProjectPath = useLedgerStore((s) => s.selectedProjectPath);
  const statusFilter = useLedgerStore((s) => s.statusFilter);
  const searchQuery = useLedgerStore((s) => s.searchQuery);
  const isLoading = useLedgerStore((s) => s.isLoading);
  const error = useLedgerStore((s) => s.error);

  // Actions — stable references from create()
  const setLedgers = useLedgerStore((s) => s.setLedgers);
  const setProjects = useLedgerStore((s) => s.setProjects);
  const setSelectedLedger = useLedgerStore((s) => s.setSelectedLedger);
  const setSelectedProject = useLedgerStore((s) => s.setSelectedProject);
  const setStatusFilter = useLedgerStore((s) => s.setStatusFilter);
  const setSearchQuery = useLedgerStore((s) => s.setSearchQuery);
  const setLoading = useLedgerStore((s) => s.setLoading);
  const setError = useLedgerStore((s) => s.setError);
  const updateLedger = useLedgerStore((s) => s.updateLedger);
  const getLedgersForProject = useLedgerStore((s) => s.getLedgersForProject);

  // Memoized derived state from standalone selectors (1A + 1E)
  const filteredLedgers = useFilteredLedgers();
  const selectedLedger = useSelectedLedger();
  const selectedProject = useSelectedProject();

  // Memoized counts (1E)
  const counts = useMemo(() => ({
    all: ledgers.length,
    active: ledgers.filter((l) => l.status === 'active').length,
    stale: ledgers.filter((l) => l.status === 'stale').length,
    completed: ledgers.filter((l) => l.status === 'completed').length,
  }), [ledgers]);

  // Load ledgers on mount
  const loadLedgers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [ledgersData, projectsData] = await Promise.all([
        window.electronAPI.getLedgersEnhanced(),
        window.electronAPI.getProjectsWithLedgers(),
      ]);

      setLedgers(ledgersData);
      setProjects(projectsData);
    } catch (err) {
      console.error('Failed to load ledgers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ledgers');
    } finally {
      setLoading(false);
    }
  }, [setLedgers, setProjects, setLoading, setError]);

  // Load on mount
  useEffect(() => {
    loadLedgers();
  }, [loadLedgers]);

  // Resume session from a ledger
  const resumeFromLedger = useCallback(
    async (ledger: Ledger): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await window.electronAPI.resumeFromLedger(
          ledger.projectPath,
          ledger.filename
        );

        if (!result.success) {
          return { success: false, error: result.error };
        }

        return { success: true };
      } catch (err) {
        console.error('Failed to resume from ledger:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to resume from ledger',
        };
      }
    },
    []
  );

  // Read ledger content
  const readLedger = useCallback(
    async (path: string): Promise<{ content?: string; error?: string }> => {
      try {
        const content = await window.electronAPI.readLedger(path);
        return { content };
      } catch (err) {
        console.error('Failed to read ledger:', err);
        return {
          error: err instanceof Error ? err.message : 'Failed to read ledger',
        };
      }
    },
    []
  );

  // Write ledger content
  const writeLedger = useCallback(
    async (
      path: string,
      content: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await window.electronAPI.writeLedger(path, content);

        if (result.success) {
          // Reload ledgers to get updated data
          await loadLedgers();
        }

        return result;
      } catch (err) {
        console.error('Failed to write ledger:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to write ledger',
        };
      }
    },
    [loadLedgers]
  );

  // Parse ledger content
  const parseLedger = useCallback(async (path: string) => {
    try {
      return await window.electronAPI.parseLedger(path);
    } catch (err) {
      console.error('Failed to parse ledger:', err);
      return null;
    }
  }, []);

  return {
    // State
    ledgers,
    filteredLedgers,
    projects,
    selectedLedgerPath,
    selectedLedger,
    selectedProjectPath,
    selectedProject,
    statusFilter,
    searchQuery,
    isLoading,
    error,
    counts,

    // Actions
    loadLedgers,
    setSelectedLedger,
    setSelectedProject,
    setStatusFilter,
    setSearchQuery,
    updateLedger,
    resumeFromLedger,
    readLedger,
    writeLedger,
    parseLedger,
    getLedgersForProject,
  };
}
