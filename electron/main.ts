import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// Database and indexer services
import {
  initDatabase,
  closeDatabase,
  getSessions,
  getSession,
  getSessionEvents,
  searchSessions,
  getStats,
  updateSessionAnnotations,
  updateSessionStatus,
} from './services/database';
import {
  indexAllSessions,
  startWatcher,
  stopWatcher,
  setSessionUpdateCallback,
} from './services/session-indexer';
import {
  getTmuxPanes,
  spawnClaudeSession,
  startPeriodicMapping,
  stopPeriodicMapping,
  mapAllPanes,
} from './services/tmux-mapper';
import type { Session } from '../src/types/electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (process.platform === 'win32') {
  app.setAppUserModelId(app.getName());
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e',
    show: false,
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    // In development, load from Vite dev server
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Hide instead of close when clicking X (for tray)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  // Create a simple tray icon (will be replaced with actual icon)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Session Manager',
      click: () => {
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Claude Session Manager');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}

// Track if we're quitting (separate from app to avoid type conflicts)
let isQuitting = false;

app.whenReady().then(async () => {
  // Initialize database
  console.log('[Main] Initializing database...');
  initDatabase();

  // Create window
  await createWindow();
  createTray();

  // Set up session update callback to notify renderer
  setSessionUpdateCallback((session: Session) => {
    mainWindow?.webContents.send('session-updated', session);
  });

  // Start file watcher
  console.log('[Main] Starting session watcher...');
  startWatcher((session: Session) => {
    mainWindow?.webContents.send('session-updated', session);
  });

  // Run initial index in background
  console.log('[Main] Starting initial session index...');
  indexAllSessions().then((count) => {
    console.log(`[Main] Initial index complete: ${count} sessions`);
    mainWindow?.webContents.send('index-complete', { count });
  });

  // Start tmux mapping
  console.log('[Main] Starting tmux mapper...');
  startPeriodicMapping(30000);
  mapAllPanes();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  // Clean up
  stopWatcher();
  stopPeriodicMapping();
  closeDatabase();
});

// ============================================================
// IPC Handlers
// ============================================================

// Get all sessions (optionally filtered by status)
ipcMain.handle('get-sessions', async (_event, status?: string) => {
  return getSessions(status);
});

// Get a single session by ID
ipcMain.handle('get-session', async (_event, sessionId: string) => {
  return getSession(sessionId);
});

// Get session events
ipcMain.handle('get-session-events', async (_event, sessionId: string) => {
  return getSessionEvents(sessionId);
});

// Search sessions using FTS5
ipcMain.handle('search-sessions', async (_event, query: string) => {
  return searchSessions(query);
});

// Get session statistics
ipcMain.handle('get-stats', async () => {
  return getStats();
});

// Update session annotations (name, tags, ledger link)
ipcMain.handle('update-session-annotations', async (
  _event,
  sessionId: string,
  annotations: { name?: string; tags?: string; ledgerLink?: string }
) => {
  updateSessionAnnotations(sessionId, annotations.name, annotations.tags, annotations.ledgerLink);
  return getSession(sessionId);
});

// Update session status
ipcMain.handle('update-session-status', async (
  _event,
  sessionId: string,
  status: 'active' | 'idle' | 'completed'
) => {
  updateSessionStatus(sessionId, status);
  return getSession(sessionId);
});

// Trigger a full reindex
ipcMain.handle('reindex', async () => {
  const count = await indexAllSessions();
  return { count };
});

// ============================================================
// tmux IPC Handlers
// ============================================================

// Get all tmux panes
ipcMain.handle('get-tmux-panes', async () => {
  return getTmuxPanes();
});

// Spawn a new Claude session
ipcMain.handle('spawn-session', async (
  _event,
  projectPath: string,
  options?: { task?: string; ledger?: string }
) => {
  return spawnClaudeSession(projectPath, options);
});

// ============================================================
// Notification IPC Handlers
// ============================================================

// Show a notification
ipcMain.handle('show-notification', async (
  _event,
  title: string,
  body: string,
  options?: { silent?: boolean }
) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      silent: options?.silent ?? false,
    });
    notification.show();
    return true;
  }
  return false;
});

// Update tray with session count
function updateTrayWithStats() {
  const stats = getStats();
  const activeCount = stats.active;

  if (tray) {
    tray.setToolTip(`Claude Session Manager - ${activeCount} active session${activeCount !== 1 ? 's' : ''}`);

    // Update context menu with active sessions
    const activeSessions = getSessions('active').slice(0, 5);
    const menuItems: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Show Session Manager',
        click: () => mainWindow?.show(),
      },
      { type: 'separator' },
    ];

    if (activeSessions.length > 0) {
      menuItems.push({
        label: `Active Sessions (${activeCount})`,
        enabled: false,
      });

      for (const session of activeSessions) {
        menuItems.push({
          label: `  ${session.project_name}${session.detected_task ? ' - ' + session.detected_task.substring(0, 30) : ''}`,
          click: () => {
            mainWindow?.show();
            mainWindow?.webContents.send('select-session', session.session_id);
          },
        });
      }

      menuItems.push({ type: 'separator' });
    }

    menuItems.push({
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    });

    tray.setContextMenu(Menu.buildFromTemplate(menuItems));
  }
}

// Update tray periodically
setInterval(updateTrayWithStats, 30000);
