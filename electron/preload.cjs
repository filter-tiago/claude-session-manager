// Preload script - must be CommonJS for Electron context isolation
const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  // Session operations
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  getSession: (sessionId) => ipcRenderer.invoke('get-session', sessionId),
  getSessionEvents: (sessionId) => ipcRenderer.invoke('get-session-events', sessionId),
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

  // Database operations
  getStats: () => ipcRenderer.invoke('get-stats'),
  reindex: () => ipcRenderer.invoke('reindex'),

  // Notifications
  showNotification: (title, body, options) =>
    ipcRenderer.invoke('show-notification', title, body, options),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
