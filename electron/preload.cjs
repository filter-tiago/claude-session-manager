// Preload script - must be CommonJS for Electron context isolation
const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  // Session operations
  getSessions: (options) => ipcRenderer.invoke('get-sessions', options),
  getTotalSessionCount: () => ipcRenderer.invoke('get-total-session-count'),
  getSession: (sessionId) => ipcRenderer.invoke('get-session', sessionId),
  getSessionEvents: (sessionId, afterIndex) => ipcRenderer.invoke('get-session-events', sessionId, afterIndex),
  searchSessions: (query) => ipcRenderer.invoke('search-sessions', query),

  // Session watcher events
  onSessionUpdate: (callback) => {
    const listener = (_event, session) => callback(session);
    ipcRenderer.on('session-updated', listener);
    return () => {
      ipcRenderer.removeListener('session-updated', listener);
    };
  },

  onSessionCreated: (callback) => {
    const listener = (_event, session) => callback(session);
    ipcRenderer.on('session-created', listener);
    return () => {
      ipcRenderer.removeListener('session-created', listener);
    };
  },

  // Index events
  onIndexComplete: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('index-complete', listener);
    return () => {
      ipcRenderer.removeListener('index-complete', listener);
    };
  },

  onSelectSession: (callback) => {
    const listener = (_event, sessionId) => callback(sessionId);
    ipcRenderer.on('select-session', listener);
    return () => {
      ipcRenderer.removeListener('select-session', listener);
    };
  },

  // tmux operations
  getTmuxPanes: () => ipcRenderer.invoke('get-tmux-panes'),
  spawnSession: (projectPath, options) =>
    ipcRenderer.invoke('spawn-session', projectPath, options),
  sendToPane: (sessionId, command) =>
    ipcRenderer.invoke('send-to-pane', sessionId, command),

  // Database operations
  getDistinctProjects: () => ipcRenderer.invoke('get-distinct-projects'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  reindex: () => ipcRenderer.invoke('reindex'),

  // Notifications
  showNotification: (title, body, options) =>
    ipcRenderer.invoke('show-notification', title, body, options),

  // Ledger operations
  getLedgers: () => ipcRenderer.invoke('get-ledgers'),
  getLedgersEnhanced: () => ipcRenderer.invoke('get-ledgers-enhanced'),
  getProjectsWithLedgers: () => ipcRenderer.invoke('get-projects-with-ledgers'),
  readLedger: (path) => ipcRenderer.invoke('read-ledger', path),
  resumeFromLedger: (projectPath, ledgerFilename) =>
    ipcRenderer.invoke('resume-from-ledger', projectPath, ledgerFilename),
  writeLedger: (path, content) =>
    ipcRenderer.invoke('write-ledger', path, content),
  updateLedger: (path, updates) =>
    ipcRenderer.invoke('update-ledger', path, updates),
  parseLedger: (path) =>
    ipcRenderer.invoke('parse-ledger', path),
  createHandoff: (sessionId) =>
    ipcRenderer.invoke('create-handoff', sessionId),
  splitSession: (sessionId, task) =>
    ipcRenderer.invoke('split-session', sessionId, task),

  // Session notification events
  onSessionNotification: (callback) => {
    const listener = (_event, notification) => callback(notification);
    ipcRenderer.on('session-notification', listener);
    return () => {
      ipcRenderer.removeListener('session-notification', listener);
    };
  },

  // Notification paths (for debugging/settings)
  getNotificationPaths: () => ipcRenderer.invoke('get-notification-paths'),

  // Pending notifications
  getPendingNotifications: () => ipcRenderer.invoke('get-pending-notifications'),
  clearNotification: (eventId) => ipcRenderer.invoke('clear-notification', eventId),
  clearAllNotifications: () => ipcRenderer.invoke('clear-all-notifications'),

  // Notification configuration
  getNotificationConfig: () => ipcRenderer.invoke('get-notification-config'),
  configureNotifications: (options) => ipcRenderer.invoke('configure-notifications', options),

  // Sound controls
  playSound: (type) => ipcRenderer.invoke('play-sound', type),
  testSound: (type) => ipcRenderer.invoke('test-sound', type),
  getSoundTypes: () => ipcRenderer.invoke('get-sound-types'),
  setVolume: (volume) => ipcRenderer.invoke('set-volume', volume),
  getVolume: () => ipcRenderer.invoke('get-volume'),
  setSoundsEnabled: (enabled) => ipcRenderer.invoke('set-sounds-enabled', enabled),
  isSoundsEnabled: () => ipcRenderer.invoke('is-sounds-enabled'),

  // Settings operations
  getSettings: (scope, projectPath) => ipcRenderer.invoke('get-settings', scope, projectPath),
  saveSettings: (scope, settings, projectPath) => ipcRenderer.invoke('save-settings', scope, settings, projectPath),
  getMcpConfig: () => ipcRenderer.invoke('get-mcp-config'),
  saveMcpConfig: (config) => ipcRenderer.invoke('save-mcp-config', config),

  // Settings change events
  onSettingsChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('settings-changed', listener);
    return () => {
      ipcRenderer.removeListener('settings-changed', listener);
    };
  },

  // Hook operations
  getHooks: (projectPath) => ipcRenderer.invoke('get-hooks', projectPath),
  getHookSource: (hookPath, projectPath) => ipcRenderer.invoke('get-hook-source', hookPath, projectPath),
  testHook: (command, input, timeout, projectPath) => ipcRenderer.invoke('test-hook', command, input, timeout, projectPath),
  toggleHook: (eventType, configIndex, hookIndex, enabled, scope, projectPath) =>
    ipcRenderer.invoke('toggle-hook', eventType, configIndex, hookIndex, enabled, scope, projectPath),
  addHook: (eventType, command, scope, options, projectPath) =>
    ipcRenderer.invoke('add-hook', eventType, command, scope, options, projectPath),
  getHookTestExample: (eventType) => ipcRenderer.invoke('get-test-input-example', eventType),

  // Skill operations
  getSkills: (projectPath) => ipcRenderer.invoke('get-skills', projectPath),
  getSkillContent: (skillPath) => ipcRenderer.invoke('get-skill-content', skillPath),
  testSkillTrigger: (prompt, projectPath) => ipcRenderer.invoke('test-skill-trigger', prompt, projectPath),

  // Rule operations
  getRules: (projectPath) => ipcRenderer.invoke('get-rules', projectPath),
  getRuleContent: (rulePath) => ipcRenderer.invoke('get-rule-content', rulePath),
  toggleRule: (rulePath, enabled) => ipcRenderer.invoke('toggle-rule', rulePath, enabled),

  // Cross-session intelligence
  getFileConflicts: () => ipcRenderer.invoke('get-file-conflicts'),
  getRelatedSessions: (sessionId) => ipcRenderer.invoke('get-related-sessions', sessionId),

  // MCP server operations
  testMcpServer: (serverName) => ipcRenderer.invoke('test-mcp-server', serverName),
  getMcpServerStatuses: () => ipcRenderer.invoke('get-mcp-server-statuses'),
  toggleMcpServer: (serverName, enabled) => ipcRenderer.invoke('toggle-mcp-server', serverName, enabled),
  addMcpServer: (name, command, args, env) => ipcRenderer.invoke('add-mcp-server', name, command, args, env),
  removeMcpServer: (name) => ipcRenderer.invoke('remove-mcp-server', name),

  // Terminal (PTY) operations
  terminalConnect: (sessionId, tmuxSession, tmuxPane, cols, rows) =>
    ipcRenderer.invoke('terminal-connect', sessionId, tmuxSession, tmuxPane, cols, rows),
  terminalInput: (sessionId, data) =>
    ipcRenderer.send('terminal-input', sessionId, data),
  terminalSpecialKey: (sessionId, key) =>
    ipcRenderer.send('terminal-special-key', sessionId, key),
  terminalDisconnect: (sessionId) =>
    ipcRenderer.invoke('terminal-disconnect', sessionId),
  terminalResize: (sessionId, cols, rows) =>
    ipcRenderer.invoke('terminal-resize', sessionId, cols, rows),
  getActivePtyCount: () => ipcRenderer.invoke('get-active-pty-count'),
  capturePaneSnapshot: (tmuxSession, tmuxPane) => ipcRenderer.invoke('capture-pane-snapshot', tmuxSession, tmuxPane),
  onTerminalOutput: (callback) => {
    const listener = (_event, sessionId, data) => callback(sessionId, data);
    ipcRenderer.on('terminal-output', listener);
    return () => {
      ipcRenderer.removeListener('terminal-output', listener);
    };
  },
  onTerminalExit: (callback) => {
    const listener = (_event, sessionId, exitCode) => callback(sessionId, exitCode);
    ipcRenderer.on('terminal-exit', listener);
    return () => {
      ipcRenderer.removeListener('terminal-exit', listener);
    };
  },

  // Insights operations
  getSessionCorrections: (options) => ipcRenderer.invoke('get-session-corrections', options),
  getWorkflowPatterns: () => ipcRenderer.invoke('get-workflow-patterns'),
  getRuleSuggestions: () => ipcRenderer.invoke('get-rule-suggestions'),
  getConfigHealth: () => ipcRenderer.invoke('get-config-health'),
  refreshInsights: () => ipcRenderer.invoke('refresh-insights'),
  getToolUsageStats: () => ipcRenderer.invoke('get-tool-usage-stats'),
  getFileModificationFrequency: (limit) => ipcRenderer.invoke('get-file-modification-frequency', limit),

  // Terminal launcher operations
  openSessionTerminal: (session, tmuxSessionName) => ipcRenderer.invoke('open-session-terminal', session, tmuxSessionName),

  // Workspace operations
  createWorkspace: (options) => ipcRenderer.invoke('create-workspace', options),
  getWorkspaces: (options) => ipcRenderer.invoke('get-workspaces', options),
  getWorkspace: (id) => ipcRenderer.invoke('get-workspace', id),
  getWorkspaceSessions: (workspaceId) => ipcRenderer.invoke('get-workspace-sessions', workspaceId),
  completeWorkspace: (workspaceId, options) => ipcRenderer.invoke('complete-workspace', workspaceId, options),
  attachWorkspace: (workspaceId) => ipcRenderer.invoke('attach-workspace', workspaceId),
  restoreWorkspace: (workspaceId) => ipcRenderer.invoke('restore-workspace', workspaceId),
  deleteWorkspace: (workspaceId, options) => ipcRenderer.invoke('delete-workspace', workspaceId, options),

  // AI Search operations
  aiSearch: (options) => ipcRenderer.invoke('ai-search', options),
  hybridSearch: (query, projectFilter) => ipcRenderer.invoke('hybrid-search', query, projectFilter),
  getDistinctProjectPaths: () => ipcRenderer.invoke('get-distinct-project-paths'),

  // Tmux Management operations
  getTmuxSessions: () => ipcRenderer.invoke('get-tmux-sessions'),
  killTmuxSession: (name) => ipcRenderer.invoke('kill-tmux-session', name),
  renameTmuxSession: (oldName, newName) => ipcRenderer.invoke('rename-tmux-session', oldName, newName),
  attachTmuxSession: (name) => ipcRenderer.invoke('attach-tmux-session', name),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
