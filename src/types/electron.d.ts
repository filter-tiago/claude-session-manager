export interface Session {
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

export interface SessionEvent {
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

export interface TmuxPane {
  session: string;
  window: number;
  pane: number;
  pid: number;
  cwd?: string;
}

export interface SessionStats {
  total: number;
  active: number;
  idle: number;
  completed: number;
  indexed_today: number;
}

export interface ElectronAPI {
  // Session operations
  getSessions: () => Promise<Session[]>;
  getSession: (sessionId: string) => Promise<Session | null>;
  getSessionEvents: (sessionId: string) => Promise<SessionEvent[]>;
  searchSessions: (query: string) => Promise<Session[]>;

  // Session watcher events
  onSessionUpdate: (callback: (session: Session) => void) => () => void;
  onSessionCreated: (callback: (session: Session) => void) => () => void;

  // tmux operations
  getTmuxPanes: () => Promise<TmuxPane[]>;
  spawnSession: (
    projectPath: string,
    options?: { task?: string; ledger?: string }
  ) => Promise<{ success: boolean; error?: string }>;

  // Database operations
  getStats: () => Promise<SessionStats>;
  reindex: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
