import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import type { WorkspaceWithStats, Session } from '../types/electron';

export type FilterStatus = 'active' | 'completed' | 'all';

interface WorkspaceStore {
  // State
  workspaces: WorkspaceWithStats[];
  selectedWorkspaceId: number | null;
  filterStatus: FilterStatus;
  isLoading: boolean;
  error: string | null;

  // Selected workspace sessions (cached separately)
  selectedWorkspaceSessions: Session[];
  sessionsLoading: boolean;

  // Actions
  setWorkspaces: (workspaces: WorkspaceWithStats[]) => void;
  setSelectedWorkspace: (id: number | null) => void;
  setFilterStatus: (status: FilterStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateWorkspace: (workspace: WorkspaceWithStats) => void;
  addWorkspace: (workspace: WorkspaceWithStats) => void;
  removeWorkspace: (id: number) => void;
  setSelectedWorkspaceSessions: (sessions: Session[]) => void;
  setSessionsLoading: (loading: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  // Initial state
  workspaces: [],
  selectedWorkspaceId: null,
  filterStatus: 'active',
  isLoading: false,
  error: null,
  selectedWorkspaceSessions: [],
  sessionsLoading: false,

  // Actions
  setWorkspaces: (workspaces) => set({ workspaces }),

  setSelectedWorkspace: (id) => set({
    selectedWorkspaceId: id,
    selectedWorkspaceSessions: [], // Clear when switching
  }),

  setFilterStatus: (status) => set({ filterStatus: status }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  updateWorkspace: (workspace) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === workspace.id ? workspace : w
      ),
    })),

  addWorkspace: (workspace) =>
    set((state) => ({
      workspaces: [workspace, ...state.workspaces],
    })),

  removeWorkspace: (id) =>
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      selectedWorkspaceId: state.selectedWorkspaceId === id ? null : state.selectedWorkspaceId,
    })),

  setSelectedWorkspaceSessions: (sessions) => set({ selectedWorkspaceSessions: sessions }),

  setSessionsLoading: (loading) => set({ sessionsLoading: loading }),
}));

/**
 * Standalone memoized selector for filtered workspaces.
 */
export function useFilteredWorkspaces(): WorkspaceWithStats[] {
  return useWorkspaceStore(
    useShallow((state) => {
      const { workspaces, filterStatus } = state;

      if (filterStatus === 'all') {
        return workspaces;
      }

      return workspaces.filter((w) => w.status === filterStatus);
    })
  );
}
