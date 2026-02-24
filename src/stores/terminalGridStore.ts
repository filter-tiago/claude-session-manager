import { create } from 'zustand';

interface ConnectionInfo {
  tmuxSession: string;
  tmuxPane: string;
  connectedAt: number;
  lastFocusedAt: number;
}

interface TerminalGridState {
  columns: number;
  viewMode: 'terminals' | 'cards';
  maxConnections: number;
  connectedPanes: Map<string, ConnectionInfo>;
  connectingPanes: Set<string>;
  focusedPaneId: string | null;

  setColumns: (n: number) => void;
  setViewMode: (mode: 'terminals' | 'cards') => void;
  setFocusedPane: (id: string | null) => void;
  registerConnection: (paneId: string, tmuxSession: string, tmuxPane: string) => void;
  unregisterConnection: (paneId: string) => void;
  addConnecting: (id: string) => void;
  removeConnecting: (id: string) => void;
  promoteToConnected: (paneId: string, tmuxSession: string, tmuxPane: string) => void;
  touchConnection: (paneId: string) => void;
  getLeastRecentlyUsed: () => string | null;
  isConnected: (paneId: string) => boolean;
  getConnectedCount: () => number;
  canConnect: () => boolean;
}

export const useTerminalGridStore = create<TerminalGridState>((set, get) => ({
  columns: 2,
  viewMode: 'terminals',
  maxConnections: 6,
  connectedPanes: new Map(),
  connectingPanes: new Set(),
  focusedPaneId: null,

  setColumns: (n) => set({ columns: n }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setFocusedPane: (id) => set({ focusedPaneId: id }),

  registerConnection: (paneId, tmuxSession, tmuxPane) => {
    const newMap = new Map(get().connectedPanes);
    newMap.set(paneId, {
      tmuxSession,
      tmuxPane,
      connectedAt: Date.now(),
      lastFocusedAt: Date.now(),
    });
    set({ connectedPanes: newMap });
  },

  unregisterConnection: (paneId) => {
    const newMap = new Map(get().connectedPanes);
    newMap.delete(paneId);
    set({ connectedPanes: newMap });
  },

  addConnecting: (id) => {
    const newSet = new Set(get().connectingPanes);
    newSet.add(id);
    set({ connectingPanes: newSet });
  },

  removeConnecting: (id) => {
    const newSet = new Set(get().connectingPanes);
    newSet.delete(id);
    set({ connectingPanes: newSet });
  },

  promoteToConnected: (paneId, tmuxSession, tmuxPane) => {
    const state = get();
    const newConnecting = new Set(state.connectingPanes);
    newConnecting.delete(paneId);
    const newConnected = new Map(state.connectedPanes);
    newConnected.set(paneId, {
      tmuxSession,
      tmuxPane,
      connectedAt: Date.now(),
      lastFocusedAt: Date.now(),
    });
    set({ connectingPanes: newConnecting, connectedPanes: newConnected });
  },

  touchConnection: (paneId) => {
    const newMap = new Map(get().connectedPanes);
    const info = newMap.get(paneId);
    if (info) {
      newMap.set(paneId, { ...info, lastFocusedAt: Date.now() });
      set({ connectedPanes: newMap });
    }
  },

  getLeastRecentlyUsed: () => {
    const { connectedPanes, focusedPaneId } = get();
    let lruId: string | null = null;
    let lruTime = Infinity;
    for (const [id, info] of connectedPanes) {
      // Never evict the focused pane
      if (id === focusedPaneId) continue;
      if (info.lastFocusedAt < lruTime) {
        lruTime = info.lastFocusedAt;
        lruId = id;
      }
    }
    return lruId;
  },

  isConnected: (paneId) => get().connectedPanes.has(paneId),
  getConnectedCount: () => get().connectedPanes.size,
  canConnect: () => (get().connectedPanes.size + get().connectingPanes.size) < get().maxConnections,
}));
