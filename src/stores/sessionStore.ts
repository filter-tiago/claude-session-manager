import { create } from 'zustand';
import type { Session, SessionStats } from '../types/electron';

interface SessionFilters {
  status?: 'active' | 'idle' | 'completed';
  project?: string;
}

interface SessionStore {
  // State
  sessions: Session[];
  selectedSessionId: string | null;
  searchQuery: string;
  filters: SessionFilters;
  stats: SessionStats | null;
  isLoading: boolean;

  // Actions
  setSessions: (sessions: Session[]) => void;
  setSelectedSession: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: SessionFilters) => void;
  setStats: (stats: SessionStats) => void;
  setLoading: (loading: boolean) => void;
  updateSession: (session: Session) => void;
  addSession: (session: Session) => void;

  // Computed/Filtered
  getFilteredSessions: () => Session[];
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  sessions: [],
  selectedSessionId: null,
  searchQuery: '',
  filters: {},
  stats: null,
  isLoading: false,

  // Actions
  setSessions: (sessions) => set({ sessions }),

  setSelectedSession: (id) => set({ selectedSessionId: id }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFilters: (filters) => set({ filters }),

  setStats: (stats) => set({ stats }),

  setLoading: (loading) => set({ isLoading: loading }),

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

  // Computed
  getFilteredSessions: () => {
    const { sessions, filters, searchQuery } = get();
    let filtered = sessions;

    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter((s) => s.status === filters.status);
    }

    // Apply project filter
    if (filters.project) {
      filtered = filtered.filter((s) => s.project_path === filters.project);
    }

    // Apply search query (local filtering when not using FTS)
    if (searchQuery) {
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
  },
}));
