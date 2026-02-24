import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import type { Session, SessionStats } from '../types/electron';

export interface SessionFilters {
  status?: 'active' | 'idle' | 'completed';
  project?: string;
}

export type FilterMode = 'smart' | 'all' | 'search';

interface SessionStore {
  // State
  sessions: Session[];
  selectedSessionId: string | null;
  searchQuery: string;
  filters: SessionFilters;
  stats: SessionStats | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreSessions: boolean;
  // Smart filtering state (centralized to avoid split state)
  filterMode: FilterMode;
  totalCount: number;
  error: string | null;

  // Actions
  setSessions: (sessions: Session[]) => void;
  setSelectedSession: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: SessionFilters) => void;
  setStats: (stats: SessionStats) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setHasMoreSessions: (hasMore: boolean) => void;
  appendSessions: (sessions: Session[]) => void;
  updateSession: (session: Session) => void;
  addSession: (session: Session) => void;
  // Smart filtering actions
  setFilterMode: (mode: FilterMode) => void;
  setTotalCount: (count: number) => void;
  setError: (error: string | null) => void;
  resetFilters: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  // Initial state
  sessions: [],
  selectedSessionId: null,
  searchQuery: '',
  filters: {},
  stats: null,
  isLoading: false,
  isLoadingMore: false,
  hasMoreSessions: false,
  // Smart filtering state
  filterMode: 'smart',
  totalCount: 0,
  error: null,

  // Actions
  setSessions: (sessions) => set({ sessions }),

  setSelectedSession: (id) => set({ selectedSessionId: id }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFilters: (filters) => set({ filters }),

  setStats: (stats) => set({ stats }),

  setLoading: (loading) => set({ isLoading: loading }),

  setLoadingMore: (loading) => set({ isLoadingMore: loading }),

  setHasMoreSessions: (hasMore) => set({ hasMoreSessions: hasMore }),

  appendSessions: (newSessions) =>
    set((state) => {
      if (newSessions.length === 0) return state;

      const merged = [...state.sessions];
      const indexById = new Map(merged.map((session, index) => [session.session_id, index]));

      for (const session of newSessions) {
        const existingIndex = indexById.get(session.session_id);
        if (existingIndex === undefined) {
          indexById.set(session.session_id, merged.length);
          merged.push(session);
        } else {
          merged[existingIndex] = session;
        }
      }

      return { sessions: merged };
    }),

  updateSession: (session) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.session_id === session.session_id ? session : s
      ),
    })),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
    })),

  // Smart filtering actions
  setFilterMode: (mode) => set({ filterMode: mode }),

  setTotalCount: (count) => set({ totalCount: count }),

  setError: (error) => set({ error }),

  resetFilters: () => set({ filters: {}, searchQuery: '', filterMode: 'smart' }),
}));

/**
 * Standalone memoized selector for filtered sessions.
 * Uses useShallow so the returned array is referentially stable
 * when the filtering inputs haven't changed.
 */
export function useFilteredSessions(): Session[] {
  return useSessionStore(
    useShallow((state) => {
      const { sessions, filters, searchQuery, filterMode } = state;
      let filtered = sessions;

      // Apply status filter (only for local filtering, not for search/server results)
      if (filters.status && filterMode !== 'search') {
        filtered = filtered.filter((s) => s.status === filters.status);
      }

      // Apply project filter
      if (filters.project) {
        filtered = filtered.filter((s) => s.project_path === filters.project);
      }

      // Apply search query (local filtering when not using FTS)
      if (searchQuery && filterMode !== 'search') {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            s.project_name?.toLowerCase().includes(query) ||
            s.detected_task?.toLowerCase().includes(query) ||
            s.detected_area?.toLowerCase().includes(query) ||
            s.name?.toLowerCase().includes(query)
        );
      }

      return filtered;
    })
  );
}
