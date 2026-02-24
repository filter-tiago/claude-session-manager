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
  tmux_alive?: boolean | null;  // true=running, false=dead, null=unknown
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

/**
 * Options for filtering sessions
 */
export interface GetSessionsOptions {
  limit?: number;           // Default: dashboard page size (200)
  offset?: number;          // Default: 0 (used when limit > 0)
  maxAgeDays?: number;      // Default: 1
  includeActive?: boolean;  // Default: true - always include active regardless of age
  status?: string;          // Optional explicit status filter
  projectPath?: string;     // Optional project filter
  showAll?: boolean;        // If true, bypasses smart filtering
}

export interface Ledger {
  name: string;
  filename: string;
  path: string;
  projectPath: string;
  lastModified: string;
  goal?: string;
  currentPhase?: string;
}

export interface LedgerProgress {
  completed: number;
  total: number;
  percentage: number;
}

export type LedgerStatus = 'active' | 'stale' | 'completed';

export interface EnhancedLedger extends Ledger {
  projectName: string;
  progress: LedgerProgress;
  status: LedgerStatus;
  hasOpenQuestions: boolean;
}

export interface ProjectWithLedgers {
  projectPath: string;
  projectName: string;
  ledgers: EnhancedLedger[];
  ledgerCount: number;
  mostRecentActivity: string;
}

export interface ParsedLedger {
  goal: string;
  constraints: string[];
  keyDecisions: string[];
  state: {
    done: Array<{ phase: string; checked: boolean }>;
    now: string;
    next: string[];
  };
  openQuestions: string[];
  workingSet: Record<string, string>;
  raw: string;
}

export interface LedgerStateUpdate {
  currentPhase?: string;
  completedPhases?: string[];
  nextPhases?: string[];
}

import type { SessionNotificationEvent, ProcessedNotification } from './notifications';

// Sound types
export type SoundType = 'success' | 'attention' | 'error' | 'subtle';

// Notification configuration
export interface NotificationConfig {
  nativeNotifications: boolean;
  inAppToasts: boolean;
  trayBadge: boolean;
}

export interface NotificationPaths {
  base: string;
  pending: string;
  processed: string;
}

// Settings types
export type SettingsScope = 'global' | 'project';

export interface HookDefinition {
  type: 'command';
  command: string;
  timeout?: number;
}

export interface HookConfig {
  matcher?: string[];
  hooks: HookDefinition[];
}

export interface ClaudeSettings {
  permissions?: Record<string, string[]>;
  env?: Record<string, string>;
  apiKeyHelper?: string;
  hooks?: Record<string, HookConfig[]>;
  allow?: string[];
  deny?: string[];
  [key: string]: unknown;
}

export interface MCPServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface MCPConfig {
  mcpServers?: Record<string, MCPServer>;
  [key: string]: unknown;
}

export interface SettingsChangedEvent {
  scope: SettingsScope;
  projectPath?: string;
  settings: ClaudeSettings | MCPConfig;
  type: 'settings' | 'mcp';
}

// Hook types
export interface HookInfo {
  name: string;
  eventType: string;
  command: string;
  matcher?: string[];
  timeout?: number;
  source: 'global' | 'project';
  enabled: boolean;
  path?: string;
  index: number;
  configIndex: number;
}

export interface HookTestResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  durationMs: number;
}

export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'Stop'
  | 'SubagentStop';

// Skill types
export interface SkillInfo {
  name: string;
  description: string;
  source: 'global' | 'project';
  path: string;
  content: string;
  triggers?: string[];
  allowedTools?: string[];
}

export interface SkillTriggerTestResult {
  matches: SkillInfo[];
  scores: number[];
}

// Rule types
export interface RuleInfo {
  name: string;
  filename: string;
  source: 'global' | 'project';
  path: string;
  content: string;
  enabled: boolean;
  description?: string;
  globs?: string[];
}

// Cross-session intelligence types
export interface FileConflict {
  file_path: string;
  sessions: Array<{ session_id: string; slug: string; project_name: string }>;
}

// Insights types
export interface CorrectionPattern {
  sessionId: string;
  timestamp: string;
  type: 'file_revert' | 'undo_edit' | 'retry_command' | 'error_fix';
  context: string;
  filesAffected: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface WorkflowPattern {
  name: string;
  sequence: string[];
  frequency: number;
  avgDurationMs: number;
  successRate: number;
  examples: Array<{ sessionId: string; timestamp: string }>;
}

export interface RuleSuggestion {
  id: string;
  type: 'hook' | 'skill' | 'rule';
  name: string;
  reason: string;
  confidence: number;
  template?: string;
  dismissed?: boolean;
}

export interface ConfigHealthIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  category: string;
  message: string;
  suggestion?: string;
  fixable?: boolean;
}

export interface ConfigHealth {
  score: number;
  issues: ConfigHealthIssue[];
  lastChecked: string;
}

export interface InsightsSummary {
  corrections: {
    total: number;
    byType: Record<string, number>;
    recentCount: number;
  };
  workflows: {
    total: number;
    topPatterns: string[];
  };
  suggestions: {
    total: number;
    byType: Record<string, number>;
  };
  configHealth: ConfigHealth;
}

export interface ToolUsageStats {
  tool: string;
  count: number;
  errorCount: number;
  errorRate: number;
}

export interface FileModificationFrequency {
  file: string;
  count: number;
  sessions: string[];
}

// MCP Server types
export interface MCPServerStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  toolCount?: number;
  error?: string;
  lastChecked: string;
  command?: string;
  args?: string[];
  disabled?: boolean;
}

export interface MCPTool {
  name: string;
  description?: string;
}

export interface MCPResource {
  uri: string;
  name?: string;
}

export interface MCPTestResult {
  success: boolean;
  tools?: MCPTool[];
  resources?: MCPResource[];
  error?: string;
  durationMs: number;
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

// AI Search types
export interface AISearchQuery {
  query: string;
  scope?: 'sessions' | 'ledgers' | 'all';
  projectFilter?: string;
  maxResults?: number;
}

export interface AISearchMatch {
  type: 'session' | 'ledger';
  id: string;
  title: string;
  relevance: number;
  evidence: string;
  path?: string;
  sessionId?: string;
  projectName?: string;
}

export interface AISearchResult {
  query: string;
  matches: AISearchMatch[];
  summary: string;
  searchedAt: string;
  durationMs: number;
  tier: 'fts' | 'ai';
}

// Tmux Session Management types
export interface TmuxSessionInfo {
  name: string;
  windows: number;
  panes: number;
  created: string;
  attached: boolean;
  lastActivity: string;
  size: string;
  claudeSessions: string[];
}

// Terminal launcher types
export interface OpenTerminalResult {
  success: boolean;
  action: 'attached' | 'resumed';
  pane?: string;
  error?: string;
}

// Workspace types
export interface Workspace {
  id: number;
  name: string;
  project_path: string;
  tmux_session: string | null;
  description: string | null;
  created_at: string;
  completed_at: string | null;
  status: 'active' | 'completed';
}

export interface WorkspaceWithStats extends Workspace {
  session_count: number;
  total_messages: number;
}

export interface CreateWorkspaceOptions {
  name: string;
  projectPath: string;
  description?: string;
  startClaude?: boolean;
}

export interface CreateWorkspaceResult {
  success: boolean;
  workspace?: Workspace;
  error?: string;
}

export interface CompleteWorkspaceResult {
  success: boolean;
  stats?: {
    sessions: number;
    messages: number;
  };
  error?: string;
}

export interface ElectronAPI {
  // Session operations
  getSessions: (options?: GetSessionsOptions) => Promise<Session[]>;
  getTotalSessionCount: () => Promise<number>;
  getSession: (sessionId: string) => Promise<Session | null>;
  getSessionEvents: (sessionId: string, afterIndex?: number) => Promise<SessionEvent[]>;
  searchSessions: (query: string) => Promise<Session[]>;

  // Session watcher events
  onSessionUpdate: (callback: (session: Session) => void) => () => void;
  onSessionCreated: (callback: (session: Session) => void) => () => void;
  onIndexComplete?: (callback: () => void) => (() => void);

  // tmux operations
  getTmuxPanes: () => Promise<TmuxPane[]>;
  spawnSession: (
    projectPath: string,
    options?: { task?: string; ledger?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  sendToPane: (
    sessionId: string,
    command: string
  ) => Promise<{ success: boolean; error?: string }>;

  // Database operations
  getDistinctProjects: () => Promise<Array<{ project_path: string; project_name: string }>>;
  getStats: () => Promise<SessionStats>;
  reindex: () => Promise<void>;

  // Ledger operations
  getLedgers: () => Promise<Ledger[]>;
  getLedgersEnhanced: () => Promise<EnhancedLedger[]>;
  getProjectsWithLedgers: () => Promise<ProjectWithLedgers[]>;
  readLedger: (path: string) => Promise<string>;
  resumeFromLedger: (
    projectPath: string,
    ledgerFilename: string
  ) => Promise<{ success: boolean; error?: string }>;
  writeLedger: (
    path: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>;
  updateLedger: (
    path: string,
    updates: LedgerStateUpdate
  ) => Promise<{ success: boolean; error?: string }>;
  parseLedger: (path: string) => Promise<ParsedLedger>;
  createHandoff: (sessionId: string) => Promise<{
    success: boolean;
    path: string;
    error?: string;
  }>;
  splitSession: (
    sessionId: string,
    task: string
  ) => Promise<{ success: boolean; error?: string }>;

  // Session notification events
  onSessionNotification: (
    callback: (notification: ProcessedNotification) => void
  ) => () => void;
  getNotificationPaths: () => Promise<NotificationPaths>;

  // Pending notifications
  getPendingNotifications: () => Promise<ProcessedNotification[]>;
  clearNotification: (eventId: string) => Promise<{ success: boolean }>;
  clearAllNotifications: () => Promise<{ success: boolean }>;

  // Notification configuration
  getNotificationConfig: () => Promise<NotificationConfig>;
  configureNotifications: (options: Partial<NotificationConfig & {
    soundsEnabled?: boolean;
    volume?: number;
  }>) => Promise<{ success: boolean }>;

  // Sound controls
  playSound: (type: SoundType) => Promise<{ success: boolean }>;
  testSound: (type: SoundType) => Promise<{ success: boolean }>;
  getSoundTypes: () => Promise<SoundType[]>;
  setVolume: (volume: number) => Promise<{ success: boolean; volume: number }>;
  getVolume: () => Promise<number>;
  setSoundsEnabled: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>;
  isSoundsEnabled: () => Promise<boolean>;

  // Settings operations
  getSettings: (scope: SettingsScope, projectPath?: string) => Promise<ClaudeSettings>;
  saveSettings: (
    scope: SettingsScope,
    settings: ClaudeSettings,
    projectPath?: string
  ) => Promise<{ success: boolean }>;
  getMcpConfig: () => Promise<MCPConfig>;
  saveMcpConfig: (config: MCPConfig) => Promise<{ success: boolean }>;

  // Settings change events
  onSettingsChanged: (callback: (event: SettingsChangedEvent) => void) => () => void;

  // Hook operations
  getHooks: (projectPath?: string) => Promise<HookInfo[]>;
  getHookSource: (hookPath: string, projectPath?: string) => Promise<string>;
  testHook: (
    command: string,
    input: Record<string, unknown>,
    timeout?: number,
    projectPath?: string
  ) => Promise<HookTestResult>;
  toggleHook: (
    eventType: string,
    configIndex: number,
    hookIndex: number,
    enabled: boolean,
    scope: SettingsScope,
    projectPath?: string
  ) => Promise<{ success: boolean; error?: string }>;
  addHook: (
    eventType: string,
    command: string,
    scope: SettingsScope,
    options?: { matcher?: string[]; timeout?: number },
    projectPath?: string
  ) => Promise<{ success: boolean; error?: string }>;
  getHookTestExample: (eventType: string) => Promise<Record<string, unknown>>;

  // Skill operations
  getSkills: (projectPath?: string) => Promise<SkillInfo[]>;
  getSkillContent: (skillPath: string) => Promise<string>;
  testSkillTrigger: (
    prompt: string,
    projectPath?: string
  ) => Promise<SkillTriggerTestResult>;

  // Rule operations
  getRules: (projectPath?: string) => Promise<RuleInfo[]>;
  getRuleContent: (rulePath: string) => Promise<string>;
  toggleRule: (
    rulePath: string,
    enabled: boolean
  ) => Promise<{ success: boolean; error?: string; newPath?: string }>;

  // Cross-session intelligence
  getFileConflicts: () => Promise<FileConflict[]>;
  getRelatedSessions: (sessionId: string) => Promise<Session[]>;

  // MCP server operations
  testMcpServer: (serverName: string) => Promise<MCPTestResult>;
  getMcpServerStatuses: () => Promise<MCPServerStatus[]>;
  toggleMcpServer: (
    serverName: string,
    enabled: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  addMcpServer: (
    name: string,
    command: string,
    args?: string[],
    env?: Record<string, string>
  ) => Promise<{ success: boolean; error?: string }>;
  removeMcpServer: (name: string) => Promise<{ success: boolean; error?: string }>;

  // Terminal (PTY) operations
  terminalConnect: (
    sessionId: string,
    tmuxSession: string,
    tmuxPane: string,
    cols?: number,
    rows?: number
  ) => Promise<{ success: boolean; error?: string }>;
  terminalInput: (sessionId: string, data: string) => void;
  terminalSpecialKey: (sessionId: string, key: string) => void;
  terminalDisconnect: (sessionId: string) => Promise<{ success: boolean }>;
  terminalResize: (
    sessionId: string,
    cols: number,
    rows: number
  ) => Promise<{ success: boolean }>;
  onTerminalOutput: (callback: (sessionId: string, data: string) => void) => () => void;
  onTerminalExit: (callback: (sessionId: string, exitCode: number) => void) => () => void;
  getActivePtyCount(): Promise<{ success: boolean; count?: number; error?: string }>;
  capturePaneSnapshot(tmuxSession: string, tmuxPane: string): Promise<{ success: boolean; snapshot?: string; error?: string }>;

  // Insights operations
  getSessionCorrections: (options?: { limit?: number }) => Promise<CorrectionPattern[]>;
  getWorkflowPatterns: () => Promise<WorkflowPattern[]>;
  getRuleSuggestions: () => Promise<RuleSuggestion[]>;
  getConfigHealth: () => Promise<ConfigHealth>;
  refreshInsights: () => Promise<InsightsSummary>;
  getToolUsageStats: () => Promise<ToolUsageStats[]>;
  getFileModificationFrequency: (limit?: number) => Promise<FileModificationFrequency[]>;

  // Terminal launcher operations
  openSessionTerminal: (session: Session, tmuxSessionName?: string) => Promise<OpenTerminalResult>;

  // Workspace operations
  createWorkspace: (options: CreateWorkspaceOptions) => Promise<CreateWorkspaceResult>;
  getWorkspaces: (options?: { status?: 'active' | 'completed' }) => Promise<WorkspaceWithStats[]>;
  getWorkspace: (id: number) => Promise<Workspace | null>;
  getWorkspaceSessions: (workspaceId: number) => Promise<Session[]>;
  completeWorkspace: (workspaceId: number, options?: { killTmux?: boolean }) => Promise<CompleteWorkspaceResult>;
  attachWorkspace: (workspaceId: number) => Promise<{ success: boolean; error?: string }>;
  restoreWorkspace: (workspaceId: number) => Promise<{ success: boolean; error?: string }>;
  deleteWorkspace: (workspaceId: number, options?: { killTmux?: boolean }) => Promise<{ success: boolean; error?: string }>;

  // AI Search operations
  aiSearch: (options: AISearchQuery) => Promise<AISearchResult>;
  hybridSearch: (query: string, projectFilter?: string) => Promise<AISearchResult>;
  getDistinctProjectPaths: () => Promise<string[]>;

  // Tmux Management operations
  getTmuxSessions: () => Promise<TmuxSessionInfo[]>;
  killTmuxSession: (name: string) => Promise<boolean>;
  renameTmuxSession: (oldName: string, newName: string) => Promise<boolean>;
  attachTmuxSession: (name: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
