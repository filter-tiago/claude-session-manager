import { contextBridge, ipcRenderer } from 'electron';

// Types are defined inline to avoid import issues in the preload context
interface Session {
  session_id: string;
  slug: string;
  project_path: string;
  project_name: string;
  working_directory?: string;
  git_branch?: string;
  permission_mode?: string;
  started_at: string;
  last_activity: string;
  status: 'active' | 'idle' | 'completed';
  message_count: number;
  tool_call_count: number;
  detected_task?: string;
  detected_activity?: string;
  detected_area?: string;
  name?: string;
  tags?: string;
  ledger_link?: string;
  tmux_session?: string;
  tmux_pane?: string;
  tmux_pane_pid?: number;
  file_path: string;
  file_size_bytes?: number;
  indexed_at: string;
}

interface SessionEvent {
  id: number;
  session_id: string;
  timestamp: string;
  event_type: string;
  content?: string;
  tool_name?: string;
  tool_input?: string;
  tool_output?: string;
  files_touched?: string;
}

interface TmuxPane {
  session: string;
  window: number;
  pane: number;
  pid: number;
  cwd?: string;
}

interface SessionStats {
  total: number;
  active: number;
  idle: number;
  completed: number;
  indexed_today: number;
}

interface GetSessionsOptions {
  limit?: number;
  offset?: number;
  maxAgeDays?: number;
  includeActive?: boolean;
  status?: string;
  projectPath?: string;
  showAll?: boolean;
}

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // Session operations
  getSessions: (options?: GetSessionsOptions) => ipcRenderer.invoke('get-sessions', options) as Promise<Session[]>,
  getSession: (sessionId: string) => ipcRenderer.invoke('get-session', sessionId) as Promise<Session | null>,
  getSessionEvents: (sessionId: string) => ipcRenderer.invoke('get-session-events', sessionId) as Promise<SessionEvent[]>,
  searchSessions: (query: string) => ipcRenderer.invoke('search-sessions', query) as Promise<Session[]>,

  // Session watcher events
  onSessionUpdate: (callback: (session: Session) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, session: Session) => callback(session);
    ipcRenderer.on('session-updated', listener);
    return () => { ipcRenderer.removeListener('session-updated', listener); };
  },

  onSessionCreated: (callback: (session: Session) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, session: Session) => callback(session);
    ipcRenderer.on('session-created', listener);
    return () => { ipcRenderer.removeListener('session-created', listener); };
  },

  // tmux operations
  getTmuxPanes: () => ipcRenderer.invoke('get-tmux-panes') as Promise<TmuxPane[]>,
  spawnSession: (projectPath: string, options?: { task?: string; ledger?: string }) =>
    ipcRenderer.invoke('spawn-session', projectPath, options) as Promise<{ success: boolean; error?: string }>,

  // Database operations
  getStats: () => ipcRenderer.invoke('get-stats') as Promise<SessionStats>,
  reindex: () => ipcRenderer.invoke('reindex') as Promise<void>,
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
