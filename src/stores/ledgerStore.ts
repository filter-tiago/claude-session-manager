import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import type { EnhancedLedger, ProjectWithLedgers } from '../types/electron';

export type StatusFilter = 'all' | 'active' | 'stale' | 'completed';

interface LedgerStore {
  // State
  ledgers: EnhancedLedger[];
  projects: ProjectWithLedgers[];
  selectedLedgerPath: string | null;
  selectedProjectPath: string | null;
  statusFilter: StatusFilter;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  setLedgers: (ledgers: EnhancedLedger[]) => void;
  setProjects: (projects: ProjectWithLedgers[]) => void;
  setSelectedLedger: (path: string | null) => void;
  setSelectedProject: (path: string | null) => void;
  setStatusFilter: (status: StatusFilter) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateLedger: (ledger: EnhancedLedger) => void;
  removeLedger: (path: string) => void;

  // Imperative getters (for use outside React components)
  getLedgersForProject: (projectPath: string) => EnhancedLedger[];
}

export const useLedgerStore = create<LedgerStore>((set, get) => ({
  // Initial state
  ledgers: [],
  projects: [],
  selectedLedgerPath: null,
  selectedProjectPath: null,
  statusFilter: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,

  // Actions
  setLedgers: (ledgers) => set({ ledgers }),

  setProjects: (projects) => set({ projects }),

  setSelectedLedger: (path) => set({ selectedLedgerPath: path }),

  setSelectedProject: (path) => set({ selectedProjectPath: path }),

  setStatusFilter: (status) => set({ statusFilter: status }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  updateLedger: (ledger) =>
    set((state) => ({
      ledgers: state.ledgers.map((l) =>
        l.path === ledger.path ? ledger : l
      ),
    })),

  removeLedger: (path) =>
    set((state) => ({
      ledgers: state.ledgers.filter((l) => l.path !== path),
      selectedLedgerPath:
        state.selectedLedgerPath === path ? null : state.selectedLedgerPath,
    })),

  getLedgersForProject: (projectPath: string) => {
    const { ledgers } = get();
    return ledgers.filter((l) => l.projectPath === projectPath);
  },
}));

/**
 * Standalone memoized selector for filtered ledgers.
 */
export function useFilteredLedgers(): EnhancedLedger[] {
  return useLedgerStore(
    useShallow((state) => {
      const { ledgers, statusFilter, searchQuery, selectedProjectPath } = state;

      let filtered = ledgers;

      // Filter by project if selected
      if (selectedProjectPath) {
        filtered = filtered.filter((l) => l.projectPath === selectedProjectPath);
      }

      // Filter by status
      if (statusFilter !== 'all') {
        filtered = filtered.filter((l) => l.status === statusFilter);
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (l) =>
            l.name.toLowerCase().includes(query) ||
            l.goal?.toLowerCase().includes(query) ||
            l.currentPhase?.toLowerCase().includes(query) ||
            l.projectName.toLowerCase().includes(query)
        );
      }

      return filtered;
    })
  );
}

/**
 * Standalone memoized selector for the selected ledger.
 */
export function useSelectedLedger(): EnhancedLedger | null {
  return useLedgerStore((state) => {
    if (!state.selectedLedgerPath) return null;
    return state.ledgers.find((l) => l.path === state.selectedLedgerPath) || null;
  });
}

/**
 * Standalone memoized selector for the selected project.
 */
export function useSelectedProject(): ProjectWithLedgers | null {
  return useLedgerStore((state) => {
    if (!state.selectedProjectPath) return null;
    return state.projects.find((p) => p.projectPath === state.selectedProjectPath) || null;
  });
}
