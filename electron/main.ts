import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
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
  getFileConflicts,
  getRelatedSessions,
  getSessionsWithEvents,
  getToolUsageStats,
  getFileModificationFrequency,
  getTotalSessionCount,
  getDistinctProjects,
  type GetSessionsOptions,
} from './services/database';
import {
  indexAllSessions,
  startWatcher,
  stopWatcher,
  setSessionUpdateCallback,
  setSessionCreatedCallback,
} from './services/session-indexer';
import {
  getTmuxPanes,
  spawnClaudeSession,
  startPeriodicMapping,
  stopPeriodicMapping,
  mapAllPanes,
  sendToPane,
  getTmuxSessions,
  killTmuxSession,
  renameTmuxSession,
} from './services/tmux-mapper';
import type { TmuxPane } from '../src/types/electron';
import {
  startNotificationWatcher,
  stopNotificationWatcher,
  cleanupOldNotifications,
  getNotificationPaths,
} from './services/notification-watcher';
import {
  initNotificationManager,
  processNotificationAsync,
  processNotificationSilent,
  forceUpdateTrayBadge,
  configureNotifications,
  getNotificationConfig,
  clearPendingNotification,
  clearAllPendingNotifications,
  getPendingNotifications,
  cleanupNotificationManager,
} from './services/notification-manager';
import {
  playSound,
  testSound,
  setVolume,
  getVolume,
  setSoundsEnabled,
  isSoundsEnabled,
  getSoundTypes,
  type SoundType,
} from './services/sound-manager';
import {
  readSettings,
  writeSettings,
  readMcpConfig,
  writeMcpConfig,
  watchSettings,
  watchMcpConfig,
  stopAllWatchers as stopConfigWatchers,
  isValidProjectPath,
  validateSettings,
  validateMcpConfig,
  type SettingsScope,
  type ClaudeSettings,
  type MCPConfig,
} from './services/config-manager';
import {
  getHooks,
  getHookSource,
  testHook,
  toggleHook,
  addHook,
  removeHook,
  getTestInputExample,
} from './services/hook-manager';
import {
  getSkills,
  getSkillContent,
  testSkillTrigger,
} from './services/skill-manager';
import {
  getRules,
  getRuleContent,
  toggleRule,
} from './services/rule-manager';
import {
  testMCPServer,
  getMCPServerStatuses,
  toggleMCPServer,
  addMCPServer,
  removeMCPServer,
} from './services/mcp-tester';
import {
  parseLedger,
  updateLedgerState,
  writeLedger as writeLedgerFile,
  isValidLedgerPath,
  getEnhancedLedgerData,
  type StateUpdate,
  type EnhancedLedgerData,
} from './services/ledger-service';
import {
  generateHandoff,
  saveHandoff,
} from './services/handoff-service';
import {
  initPtyManager,
  attachToPaneDirect,
  sendInput,
  sendSpecialKey,
  resizePty,
  detachPty,
  cleanupAllPtys,
  getActiveSessionCount,
  capturePaneSnapshot,
} from './services/pty-manager';
import {
  detectCorrectionsFromSessions,
  mineWorkflows,
} from './services/session-pattern-analyzer';
import {
  generateRuleSuggestions,
  generateWorkflowSuggestions,
  analyzeConfigHealth,
  generateInsightsSummary,
} from './services/insights-aggregator';
import {
  openSessionTerminal,
  openExternalTerminal,
} from './services/terminal-launcher';
import {
  aiSearch,
  hybridSearch,
  getDistinctProjectPaths,
  type AISearchQuery,
} from './services/ai-search';
import {
  createWorkspace,
  getWorkspacesWithStats,
  getWorkspaceSessions,
  completeWorkspace,
  attachToWorkspace,
  restoreWorkspace,
  deleteWorkspaceWithCleanup,
  getWorkspace as getWorkspaceById,
} from './services/workspace-manager';
import type { CreateWorkspaceOptions } from './services/workspace-manager';
import type { Session } from '../src/types/electron';
import type { SessionNotificationEvent } from '../src/types/notifications';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (process.platform === 'win32') {
  app.setAppUserModelId(app.getName());
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function createWindow() {
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Claude Session Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  };

  // Enable transparency and vibrancy on macOS
  if (process.platform === 'darwin') {
    windowOptions.transparent = true;
    windowOptions.vibrancy = 'under-window';
    windowOptions.visualEffectState = 'followWindow';
    windowOptions.backgroundColor = '#00000000';
  } else {
    // Solid background for Windows/Linux
    windowOptions.backgroundColor = '#0d1117';
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    // In development, load from Vite dev server
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5200';
    await mainWindow.loadURL(devServerUrl);
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
  // Create tray with empty icon - TrayManager will set the actual icon
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  // Basic tooltip - TrayManager will update this based on state
  tray.setToolTip('Claude Session Manager');

  // Note: Context menu and click handler are now managed by TrayManager
  // which is initialized in initNotificationManager
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

  // Set up session created callback for new sessions
  setSessionCreatedCallback((session: Session) => {
    console.log(`[Main] New session created: ${session.session_id}`);
    mainWindow?.webContents.send('session-created', session);
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

  // Initialize PTY manager (mainWindow is guaranteed non-null here after createWindow)
  console.log('[Main] Initializing PTY manager...');
  initPtyManager(mainWindow!);

  // Initialize notification manager with quit callback for tray menu
  console.log('[Main] Initializing notification manager...');
  initNotificationManager(mainWindow, tray, () => {
    isQuitting = true;
    app.quit();
  });

  // Start notification watcher with NotificationManager processing
  console.log('[Main] Starting notification watcher...');
  const existingNotificationCount = startNotificationWatcher((event: SessionNotificationEvent, options?: { silent?: boolean }) => {
    if (options?.silent) {
      // Startup backlog - process silently (no sound, no native notification, no IPC)
      processNotificationSilent(event);
    } else {
      console.log(`[Main] Notification received: ${event.stopType} for ${event.projectName}`);
      // Route through NotificationManager for sound, native notification, and renderer
      // Using async version to enable Claude API enhancement for high-importance events
      processNotificationAsync(event).catch((error) => {
        console.error('[Main] Error processing notification:', error);
      });
    }
  });

  // Update tray badge once after processing all startup notifications
  if (existingNotificationCount > 0) {
    console.log(`[Main] Processed ${existingNotificationCount} existing notifications silently`);
    forceUpdateTrayBadge();
  }

  // Clean up old notifications on startup
  cleanupOldNotifications(7);

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
  stopNotificationWatcher();
  stopConfigWatchers();
  cleanupNotificationManager();
  cleanupAllPtys();
  closeDatabase();
});

// ============================================================
// IPC Handlers
// ============================================================

// Get sessions with smart filtering (default) or all sessions
ipcMain.handle('get-sessions', async (_event, options?: GetSessionsOptions) => {
  try {
    return getSessions(options);
  } catch (error) {
    console.error('[Main] Error getting sessions:', error);
    return [];
  }
});

// Get distinct projects for filtering
ipcMain.handle('get-distinct-projects', async () => {
  try {
    return getDistinctProjects();
  } catch (error) {
    console.error('[Main] Error getting distinct projects:', error);
    return [];
  }
});

// Get total session count (for showing "X of Y sessions")
ipcMain.handle('get-total-session-count', async () => {
  try {
    return getTotalSessionCount();
  } catch (error) {
    console.error('[Main] Error getting total session count:', error);
    return 0;
  }
});

// Get a single session by ID
ipcMain.handle('get-session', async (_event, sessionId: string) => {
  return getSession(sessionId);
});

// Get session events (supports incremental fetching via afterIndex)
ipcMain.handle('get-session-events', async (_event, sessionId: string, afterIndex?: number) => {
  return getSessionEvents(sessionId, afterIndex);
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
  const result = await spawnClaudeSession(projectPath, options);

  // Open iTerm/Terminal attached to the new tmux session
  if (result.success && result.pane) {
    await openExternalTerminal(result.pane.session);
  }

  return result;
});

// Send command to a session's tmux pane
ipcMain.handle('send-to-pane', async (
  _event,
  sessionId: string,
  command: string
) => {
  const session = getSession(sessionId);
  if (!session?.tmux_session || !session.tmux_pane) {
    return { success: false, error: 'Session not mapped to tmux pane' };
  }

  // Parse tmux_pane format "window.pane" (e.g., "0.0")
  const paneParts = session.tmux_pane.split('.');
  if (paneParts.length !== 2) {
    return { success: false, error: 'Invalid tmux pane format' };
  }

  const pane: TmuxPane = {
    session: session.tmux_session,
    window: parseInt(paneParts[0], 10),
    pane: parseInt(paneParts[1], 10),
    pid: session.tmux_pane_pid || 0,
  };

  const success = await sendToPane(pane, command);
  return { success, error: success ? undefined : 'Failed to send to pane' };
});

// ============================================================
// Ledger IPC Handlers
// ============================================================

interface Ledger {
  name: string;
  filename: string;
  path: string;
  projectPath: string;
  lastModified: string;
  goal?: string;
  currentPhase?: string;
}

// Helper: Recursively find all thoughts/ledgers directories in workspace
function findLedgerDirs(dir: string, maxDepth = 5, currentDepth = 0): string[] {
  if (currentDepth > maxDepth) return [];

  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      // Check if this is a thoughts/ledgers path
      if (entry.name === 'thoughts') {
        const ledgerDir = path.join(fullPath, 'ledgers');
        if (fs.existsSync(ledgerDir)) {
          results.push(ledgerDir);
        }
      } else {
        // Recurse into subdirectories
        results.push(...findLedgerDirs(fullPath, maxDepth, currentDepth + 1));
      }
    }
  } catch {
    // Ignore permission errors
  }

  return results;
}

// Helper: Extract project path from ledger directory path
function getProjectPathFromLedgerDir(ledgerDir: string): string {
  // ledgerDir is like /path/to/project/thoughts/ledgers
  // We want /path/to/project
  return path.dirname(path.dirname(ledgerDir));
}

// Get all ledgers from workspace directories (recursive)
ipcMain.handle('get-ledgers', async () => {
  const ledgers: Ledger[] = [];
  const workspaceDir = path.join(os.homedir(), 'workspace');

  try {
    if (!fs.existsSync(workspaceDir)) {
      return ledgers;
    }

    // Find all ledger directories recursively
    const ledgerDirs = findLedgerDirs(workspaceDir);

    for (const ledgerDir of ledgerDirs) {
      const projectPath = getProjectPathFromLedgerDir(ledgerDir);

      const files = fs.readdirSync(ledgerDir);
      const ledgerFiles = files.filter((f) => f.startsWith('CONTINUITY_CLAUDE'));

      for (const filename of ledgerFiles) {
        const filePath = path.join(ledgerDir, filename);
        const stats = fs.statSync(filePath);

        // Extract name from filename: CONTINUITY_CLAUDE-<name>.md
        const match = filename.match(/CONTINUITY_CLAUDE-(.+)\.md$/);
        const name = match ? match[1] : filename.replace('.md', '');

        // Parse content for goal and current phase
        let goal: string | undefined;
        let currentPhase: string | undefined;

        try {
          const content = fs.readFileSync(filePath, 'utf-8');

          // Extract goal from ## Goal section
          const goalMatch = content.match(/## Goal\n([\s\S]*?)(?=\n##|\n$)/);
          if (goalMatch) {
            goal = goalMatch[1].trim().split('\n')[0].substring(0, 100);
          }

          // Extract current phase from "Now:" line
          const nowMatch = content.match(/- Now:\s*\[?[→\s]?\]?\s*(.+)/);
          if (nowMatch) {
            currentPhase = nowMatch[1].trim().substring(0, 80);
          }
        } catch {
          // Ignore parse errors
        }

        ledgers.push({
          name,
          filename,
          path: filePath,
          projectPath,
          lastModified: stats.mtime.toISOString(),
          goal,
          currentPhase,
        });
      }
    }

    // Sort by last modified, most recent first
    ledgers.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  } catch (error) {
    console.error('[Main] Error scanning for ledgers:', error);
  }

  return ledgers;
});

// Get all ledgers with enhanced data (progress, status, etc.)
interface EnhancedLedger extends Ledger {
  projectName: string;
  progress: { completed: number; total: number; percentage: number };
  status: 'active' | 'stale' | 'completed';
  hasOpenQuestions: boolean;
}

ipcMain.handle('get-ledgers-enhanced', async () => {
  const enhancedLedgers: EnhancedLedger[] = [];
  const workspaceDir = path.join(os.homedir(), 'workspace');

  try {
    if (!fs.existsSync(workspaceDir)) {
      return enhancedLedgers;
    }

    // Find all ledger directories recursively
    const ledgerDirs = findLedgerDirs(workspaceDir);

    for (const ledgerDir of ledgerDirs) {
      const projectPath = getProjectPathFromLedgerDir(ledgerDir);
      const projectName = path.basename(projectPath);

      const files = fs.readdirSync(ledgerDir);
      const ledgerFiles = files.filter((f) => f.startsWith('CONTINUITY_CLAUDE'));

      for (const filename of ledgerFiles) {
        const filePath = path.join(ledgerDir, filename);
        const stats = fs.statSync(filePath);

        // Extract name from filename: CONTINUITY_CLAUDE-<name>.md
        const match = filename.match(/CONTINUITY_CLAUDE-(.+)\.md$/);
        const name = match ? match[1] : filename.replace('.md', '');

        // Parse content for enhanced data
        let goal: string | undefined;
        let currentPhase: string | undefined;
        let enhancedData: EnhancedLedgerData = {
          projectName,
          progress: { completed: 0, total: 0, percentage: 0 },
          status: 'active',
          hasOpenQuestions: false,
        };

        try {
          const content = fs.readFileSync(filePath, 'utf-8');

          // Extract goal from ## Goal section
          const goalMatch = content.match(/## Goal\n([\s\S]*?)(?=\n##|\n$)/);
          if (goalMatch) {
            goal = goalMatch[1].trim().split('\n')[0].substring(0, 100);
          }

          // Extract current phase from "Now:" line
          const nowMatch = content.match(/- Now:\s*\[?[→\s]?\]?\s*(.+)/);
          if (nowMatch) {
            currentPhase = nowMatch[1].trim().substring(0, 80);
          }

          // Get enhanced data
          enhancedData = getEnhancedLedgerData(
            content,
            projectPath,
            stats.mtime.toISOString()
          );
        } catch {
          // Ignore parse errors
        }

        enhancedLedgers.push({
          name,
          filename,
          path: filePath,
          projectPath,
          lastModified: stats.mtime.toISOString(),
          goal,
          currentPhase,
          ...enhancedData,
        });
      }
    }

    // Sort by last modified, most recent first
    enhancedLedgers.sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  } catch (error) {
    console.error('[Main] Error scanning for enhanced ledgers:', error);
  }

  return enhancedLedgers;
});

// Get ledgers grouped by project
interface ProjectWithLedgers {
  projectPath: string;
  projectName: string;
  ledgers: EnhancedLedger[];
  ledgerCount: number;
  mostRecentActivity: string;
}

ipcMain.handle('get-projects-with-ledgers', async () => {
  const projectsMap = new Map<string, ProjectWithLedgers>();
  const workspaceDir = path.join(os.homedir(), 'workspace');

  try {
    if (!fs.existsSync(workspaceDir)) {
      return [];
    }

    // Find all ledger directories recursively
    const ledgerDirs = findLedgerDirs(workspaceDir);

    for (const ledgerDir of ledgerDirs) {
      const projectPath = getProjectPathFromLedgerDir(ledgerDir);
      const projectName = path.basename(projectPath);

      const files = fs.readdirSync(ledgerDir);
      const ledgerFiles = files.filter((f) => f.startsWith('CONTINUITY_CLAUDE'));

      if (ledgerFiles.length === 0) continue;

      const projectLedgers: EnhancedLedger[] = [];

      for (const filename of ledgerFiles) {
        const filePath = path.join(ledgerDir, filename);
        const stats = fs.statSync(filePath);

        const match = filename.match(/CONTINUITY_CLAUDE-(.+)\.md$/);
        const name = match ? match[1] : filename.replace('.md', '');

        let goal: string | undefined;
        let currentPhase: string | undefined;
        let enhancedData: EnhancedLedgerData = {
          projectName,
          progress: { completed: 0, total: 0, percentage: 0 },
          status: 'active',
          hasOpenQuestions: false,
        };

        try {
          const content = fs.readFileSync(filePath, 'utf-8');

          const goalMatch = content.match(/## Goal\n([\s\S]*?)(?=\n##|\n$)/);
          if (goalMatch) {
            goal = goalMatch[1].trim().split('\n')[0].substring(0, 100);
          }

          const nowMatch = content.match(/- Now:\s*\[?[→\s]?\]?\s*(.+)/);
          if (nowMatch) {
            currentPhase = nowMatch[1].trim().substring(0, 80);
          }

          enhancedData = getEnhancedLedgerData(
            content,
            projectPath,
            stats.mtime.toISOString()
          );
        } catch {
          // Ignore parse errors
        }

        projectLedgers.push({
          name,
          filename,
          path: filePath,
          projectPath,
          lastModified: stats.mtime.toISOString(),
          goal,
          currentPhase,
          ...enhancedData,
        });
      }

      // Sort ledgers by last modified
      projectLedgers.sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );

      projectsMap.set(projectPath, {
        projectPath,
        projectName,
        ledgers: projectLedgers,
        ledgerCount: projectLedgers.length,
        mostRecentActivity: projectLedgers[0]?.lastModified || '',
      });
    }
  } catch (error) {
    console.error('[Main] Error scanning for projects with ledgers:', error);
  }

  // Convert to array and sort by most recent activity
  const projectsArray = Array.from(projectsMap.values());
  projectsArray.sort(
    (a, b) =>
      new Date(b.mostRecentActivity).getTime() - new Date(a.mostRecentActivity).getTime()
  );

  return projectsArray;
});

// Read a ledger file
ipcMain.handle('read-ledger', async (_event, ledgerPath: string) => {
  try {
    // Security: only allow reading from workspace/*/thoughts/ledgers/
    const workspaceDir = path.join(os.homedir(), 'workspace');
    const normalizedPath = path.normalize(ledgerPath);

    if (!normalizedPath.startsWith(workspaceDir) || !normalizedPath.includes('thoughts/ledgers/')) {
      throw new Error('Invalid ledger path');
    }

    return fs.readFileSync(normalizedPath, 'utf-8');
  } catch (error) {
    console.error('[Main] Error reading ledger:', error);
    throw error;
  }
});

// Resume session from a ledger
ipcMain.handle('resume-from-ledger', async (
  _event,
  projectPath: string,
  ledgerFilename: string
) => {
  try {
    return spawnClaudeSession(projectPath, { ledger: ledgerFilename });
  } catch (error) {
    console.error('[Main] Error resuming from ledger:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Write content to a ledger file
ipcMain.handle('write-ledger', async (_event, ledgerPath: string, content: string) => {
  try {
    if (!isValidLedgerPath(ledgerPath)) {
      throw new Error('Invalid ledger path');
    }

    writeLedgerFile(ledgerPath, content);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error writing ledger:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Update ledger state (checkboxes, current phase)
ipcMain.handle('update-ledger', async (
  _event,
  ledgerPath: string,
  updates: StateUpdate
) => {
  try {
    if (!isValidLedgerPath(ledgerPath)) {
      throw new Error('Invalid ledger path');
    }

    // Read current content
    const content = fs.readFileSync(ledgerPath, 'utf-8');

    // Parse and update
    const updatedContent = updateLedgerState(content, updates);

    // Write back atomically
    writeLedgerFile(ledgerPath, updatedContent);

    return { success: true };
  } catch (error) {
    console.error('[Main] Error updating ledger:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Parse a ledger for structured data
ipcMain.handle('parse-ledger', async (_event, ledgerPath: string) => {
  try {
    if (!isValidLedgerPath(ledgerPath)) {
      throw new Error('Invalid ledger path');
    }

    const content = fs.readFileSync(ledgerPath, 'utf-8');
    return parseLedger(content);
  } catch (error) {
    console.error('[Main] Error parsing ledger:', error);
    throw error;
  }
});

// Split a session into a new child session
ipcMain.handle('split-session', async (
  _event,
  sessionId: string,
  task: string
) => {
  try {
    const session = getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Build context message linking to parent session
    const context = `Continuing from session ${session.session_id.substring(0, 8)}. ${task}`;

    return spawnClaudeSession(session.project_path, { task: context });
  } catch (error) {
    console.error('[Main] Error splitting session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Create a handoff document from session
ipcMain.handle('create-handoff', async (_event, sessionId: string) => {
  try {
    const session = getSession(sessionId);
    if (!session) {
      return { success: false, path: '', error: 'Session not found' };
    }

    const events = getSessionEvents(sessionId);

    // Try to get ledger context if available
    let ledgerContext;
    if (session.ledger_link) {
      try {
        const ledgerDir = path.join(session.project_path, 'thoughts', 'ledgers');
        const ledgerPath = path.join(ledgerDir, session.ledger_link);
        if (fs.existsSync(ledgerPath)) {
          const content = fs.readFileSync(ledgerPath, 'utf-8');
          const parsed = parseLedger(content);
          ledgerContext = {
            goal: parsed.goal,
            currentPhase: parsed.state.now,
            openQuestions: parsed.openQuestions,
          };
        }
      } catch {
        // Ignore ledger parse errors
      }
    }

    const handoffContent = generateHandoff(session, events, ledgerContext);
    const result = saveHandoff(session, handoffContent);

    return result;
  } catch (error) {
    console.error('[Main] Error creating handoff:', error);
    return {
      success: false,
      path: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
    const activeSessions = getSessions({ status: 'active' }).slice(0, 5);
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

// ============================================================
// Session Notification IPC Handlers
// ============================================================

// Get notification directory paths
ipcMain.handle('get-notification-paths', async () => {
  return getNotificationPaths();
});

// Get pending notifications
ipcMain.handle('get-pending-notifications', async () => {
  return getPendingNotifications();
});

// Clear a specific notification
ipcMain.handle('clear-notification', async (_event, eventId: string) => {
  clearPendingNotification(eventId);
  return { success: true };
});

// Clear all pending notifications
ipcMain.handle('clear-all-notifications', async () => {
  clearAllPendingNotifications();
  return { success: true };
});

// Get notification configuration
ipcMain.handle('get-notification-config', async () => {
  return getNotificationConfig();
});

// Configure notifications
ipcMain.handle('configure-notifications', async (
  _event,
  options: {
    nativeNotifications?: boolean;
    inAppToasts?: boolean;
    trayBadge?: boolean;
    soundsEnabled?: boolean;
    volume?: number;
  }
) => {
  configureNotifications(options);
  return { success: true };
});

// ============================================================
// Sound IPC Handlers
// ============================================================

// Play a sound
ipcMain.handle('play-sound', async (_event, type: SoundType) => {
  playSound(type);
  return { success: true };
});

// Test a sound (alias for play)
ipcMain.handle('test-sound', async (_event, type: SoundType) => {
  testSound(type);
  return { success: true };
});

// Get available sound types
ipcMain.handle('get-sound-types', async () => {
  return getSoundTypes();
});

// Set volume
ipcMain.handle('set-volume', async (_event, volume: number) => {
  setVolume(volume);
  return { success: true, volume: getVolume() };
});

// Get volume
ipcMain.handle('get-volume', async () => {
  return getVolume();
});

// Enable/disable sounds
ipcMain.handle('set-sounds-enabled', async (_event, enabled: boolean) => {
  setSoundsEnabled(enabled);
  return { success: true, enabled: isSoundsEnabled() };
});

// Check if sounds are enabled
ipcMain.handle('is-sounds-enabled', async () => {
  return isSoundsEnabled();
});

// ============================================================
// Settings IPC Handlers
// ============================================================

// Get Claude settings (global or project-specific)
ipcMain.handle('get-settings', async (
  _event,
  scope: SettingsScope,
  projectPath?: string
) => {
  try {
    // Validate project path if provided
    if (scope === 'project') {
      if (!projectPath) {
        throw new Error('projectPath is required for project scope');
      }
      if (!isValidProjectPath(projectPath)) {
        throw new Error('Invalid project path');
      }
    }

    return readSettings(scope, projectPath);
  } catch (error) {
    console.error('[Main] Error getting settings:', error);
    throw error;
  }
});

// Save Claude settings (global or project-specific)
ipcMain.handle('save-settings', async (
  _event,
  scope: SettingsScope,
  settings: ClaudeSettings,
  projectPath?: string
) => {
  try {
    // Validate settings structure
    if (!validateSettings(settings)) {
      throw new Error('Invalid settings structure');
    }

    // Validate project path if provided
    if (scope === 'project') {
      if (!projectPath) {
        throw new Error('projectPath is required for project scope');
      }
      if (!isValidProjectPath(projectPath)) {
        throw new Error('Invalid project path');
      }
    }

    writeSettings(scope, settings, projectPath);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error saving settings:', error);
    throw error;
  }
});

// Get MCP configuration
ipcMain.handle('get-mcp-config', async () => {
  try {
    return readMcpConfig();
  } catch (error) {
    console.error('[Main] Error getting MCP config:', error);
    throw error;
  }
});

// Save MCP configuration
ipcMain.handle('save-mcp-config', async (_event, config: MCPConfig) => {
  try {
    // Validate config structure
    if (!validateMcpConfig(config)) {
      throw new Error('Invalid MCP config structure');
    }

    writeMcpConfig(config);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error saving MCP config:', error);
    throw error;
  }
});

// Start watching settings files and emit events to renderer
function startSettingsWatchers() {
  // Watch global settings (cleanup handled by stopConfigWatchers)
  void watchSettings('global', (data) => {
    mainWindow?.webContents.send('settings-changed', data);
  });

  // Watch MCP config (cleanup handled by stopConfigWatchers)
  void watchMcpConfig((data) => {
    mainWindow?.webContents.send('settings-changed', data);
  });

  console.log('[Main] Settings watchers started');
}

// Start settings watchers after app is ready
app.whenReady().then(() => {
  startSettingsWatchers();
});

// ============================================================
// Hook IPC Handlers
// ============================================================

// Get all hooks (global and optionally project-specific)
ipcMain.handle('get-hooks', async (_event, projectPath?: string) => {
  try {
    return getHooks(projectPath);
  } catch (error) {
    console.error('[Main] Error getting hooks:', error);
    throw error;
  }
});

// Get hook script source code
ipcMain.handle('get-hook-source', async (
  _event,
  hookPath: string,
  projectPath?: string
) => {
  try {
    return getHookSource(hookPath, projectPath);
  } catch (error) {
    console.error('[Main] Error getting hook source:', error);
    throw error;
  }
});

// Test a hook with mock input
ipcMain.handle('test-hook', async (
  _event,
  command: string,
  input: Record<string, unknown>,
  timeout?: number,
  projectPath?: string
) => {
  try {
    return await testHook(command, input, timeout, projectPath);
  } catch (error) {
    console.error('[Main] Error testing hook:', error);
    throw error;
  }
});

// Toggle a hook's enabled state
ipcMain.handle('toggle-hook', async (
  _event,
  eventType: string,
  configIndex: number,
  hookIndex: number,
  enabled: boolean,
  scope: SettingsScope,
  projectPath?: string
) => {
  try {
    return toggleHook(eventType, configIndex, hookIndex, enabled, scope, projectPath);
  } catch (error) {
    console.error('[Main] Error toggling hook:', error);
    throw error;
  }
});

// Add a new hook
ipcMain.handle('add-hook', async (
  _event,
  eventType: string,
  command: string,
  scope: SettingsScope,
  options?: { matcher?: string[]; timeout?: number },
  projectPath?: string
) => {
  try {
    return addHook(eventType, command, scope, options, projectPath);
  } catch (error) {
    console.error('[Main] Error adding hook:', error);
    throw error;
  }
});

// Remove a hook
ipcMain.handle('remove-hook', async (
  _event,
  eventType: string,
  configIndex: number,
  hookIndex: number,
  scope: SettingsScope,
  projectPath?: string
) => {
  try {
    return removeHook(eventType, configIndex, hookIndex, scope, projectPath);
  } catch (error) {
    console.error('[Main] Error removing hook:', error);
    throw error;
  }
});

// Get example test input for a hook event type
ipcMain.handle('get-test-input-example', async (_event, eventType: string) => {
  return getTestInputExample(eventType);
});

// ============================================================
// Skills IPC Handlers
// ============================================================

// Get all skills (global and optionally project-specific)
ipcMain.handle('get-skills', async (_event, projectPath?: string) => {
  try {
    return getSkills(projectPath);
  } catch (error) {
    console.error('[Main] Error getting skills:', error);
    throw error;
  }
});

// Get skill SKILL.md content
ipcMain.handle('get-skill-content', async (_event, skillPath: string) => {
  try {
    return getSkillContent(skillPath);
  } catch (error) {
    console.error('[Main] Error getting skill content:', error);
    throw error;
  }
});

// Test if a prompt would trigger any skills
ipcMain.handle('test-skill-trigger', async (
  _event,
  prompt: string,
  projectPath?: string
) => {
  try {
    return testSkillTrigger(prompt, projectPath);
  } catch (error) {
    console.error('[Main] Error testing skill trigger:', error);
    throw error;
  }
});

// ============================================================
// Rules IPC Handlers
// ============================================================

// Get all rules (global and optionally project-specific)
ipcMain.handle('get-rules', async (_event, projectPath?: string) => {
  try {
    return getRules(projectPath);
  } catch (error) {
    console.error('[Main] Error getting rules:', error);
    throw error;
  }
});

// Get rule file content
ipcMain.handle('get-rule-content', async (_event, rulePath: string) => {
  try {
    return getRuleContent(rulePath);
  } catch (error) {
    console.error('[Main] Error getting rule content:', error);
    throw error;
  }
});

// Toggle rule enabled/disabled state
ipcMain.handle('toggle-rule', async (
  _event,
  rulePath: string,
  enabled: boolean
) => {
  try {
    return toggleRule(rulePath, enabled);
  } catch (error) {
    console.error('[Main] Error toggling rule:', error);
    throw error;
  }
});

// ============================================================
// Cross-Session Intelligence IPC Handlers
// ============================================================

// Get file conflicts (files edited by multiple active/idle sessions)
ipcMain.handle('get-file-conflicts', async () => {
  return getFileConflicts();
});

// Get sessions related to a given session (by shared files)
ipcMain.handle('get-related-sessions', async (_event, sessionId: string) => {
  return getRelatedSessions(sessionId);
});

// ============================================================
// MCP Server IPC Handlers
// ============================================================

// Test MCP server connectivity
ipcMain.handle('test-mcp-server', async (_event, serverName: string) => {
  try {
    return await testMCPServer(serverName);
  } catch (error) {
    console.error('[Main] Error testing MCP server:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: 0,
    };
  }
});

// Get all MCP server statuses
ipcMain.handle('get-mcp-server-statuses', async () => {
  try {
    return await getMCPServerStatuses();
  } catch (error) {
    console.error('[Main] Error getting MCP server statuses:', error);
    return [];
  }
});

// Toggle MCP server enabled/disabled
ipcMain.handle('toggle-mcp-server', async (
  _event,
  serverName: string,
  enabled: boolean
) => {
  try {
    await toggleMCPServer(serverName, enabled);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error toggling MCP server:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Add a new MCP server
ipcMain.handle('add-mcp-server', async (
  _event,
  name: string,
  command: string,
  args?: string[],
  env?: Record<string, string>
) => {
  try {
    await addMCPServer(name, command, args, env);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error adding MCP server:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Remove an MCP server
ipcMain.handle('remove-mcp-server', async (_event, name: string) => {
  try {
    await removeMCPServer(name);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error removing MCP server:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================================
// Terminal (PTY) IPC Handlers
// ============================================================

// Connect to a session's tmux pane terminal
ipcMain.handle('terminal-connect', async (
  _event,
  sessionId: string,
  tmuxSession: string,
  tmuxPane: string,
  cols?: number,
  rows?: number
) => {
  try {
    // Use direct tmux attachment for real-time output
    return await attachToPaneDirect(
      sessionId,
      tmuxSession,
      tmuxPane,
      cols || 80,
      rows || 24
    );
  } catch (error) {
    console.error('[Main] Error connecting terminal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Send input to terminal
ipcMain.on('terminal-input', (_event, sessionId: string, data: string) => {
  sendInput(sessionId, data);
});

// Send special key to terminal
ipcMain.on('terminal-special-key', (_event, sessionId: string, key: string) => {
  sendSpecialKey(sessionId, key);
});

// Disconnect from terminal
ipcMain.handle('terminal-disconnect', async (_event, sessionId: string) => {
  detachPty(sessionId);
  return { success: true };
});

// Resize terminal
ipcMain.handle('terminal-resize', async (
  _event,
  sessionId: string,
  cols: number,
  rows: number
) => {
  const success = resizePty(sessionId, cols, rows);
  return { success };
});

// Get active PTY session count
ipcMain.handle('get-active-pty-count', async () => {
  try {
    return { success: true, count: getActiveSessionCount() };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Capture a snapshot of a tmux pane's content
ipcMain.handle('capture-pane-snapshot', async (_event, tmuxSession: string, tmuxPane: string) => {
  try {
    const snapshot = await capturePaneSnapshot(tmuxSession, tmuxPane);
    return { success: true, snapshot };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ============================================================
// Insights IPC Handlers
// ============================================================

// Cache for insights (refresh on demand or every 5 minutes)
let insightsCache: {
  corrections: ReturnType<typeof detectCorrectionsFromSessions>;
  workflows: ReturnType<typeof mineWorkflows>;
  suggestions: ReturnType<typeof generateRuleSuggestions>;
  configHealth: Awaited<ReturnType<typeof analyzeConfigHealth>>;
  lastRefresh: number;
} | null = null;

const INSIGHTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function refreshInsightsCache() {
  console.log('[Main] Refreshing insights cache...');

  const sessions = getSessionsWithEvents(100);

  const corrections = detectCorrectionsFromSessions(sessions);
  const workflows = mineWorkflows(sessions);
  const correctionSuggestions = generateRuleSuggestions(corrections);
  const workflowSuggestions = generateWorkflowSuggestions(workflows);
  const suggestions = [...correctionSuggestions, ...workflowSuggestions];
  const configHealth = await analyzeConfigHealth();

  insightsCache = {
    corrections,
    workflows,
    suggestions,
    configHealth,
    lastRefresh: Date.now(),
  };

  console.log(`[Main] Insights refreshed: ${corrections.length} corrections, ${workflows.length} workflows`);

  return insightsCache;
}

async function getInsightsCache() {
  if (!insightsCache || Date.now() - insightsCache.lastRefresh > INSIGHTS_CACHE_TTL_MS) {
    return refreshInsightsCache();
  }
  return insightsCache;
}

// Get session corrections (pattern detection)
ipcMain.handle('get-session-corrections', async (_event, options?: { limit?: number }) => {
  try {
    const cache = await getInsightsCache();
    const corrections = options?.limit
      ? cache.corrections.slice(0, options.limit)
      : cache.corrections;
    return corrections;
  } catch (error) {
    console.error('[Main] Error getting session corrections:', error);
    return [];
  }
});

// Get workflow patterns
ipcMain.handle('get-workflow-patterns', async () => {
  try {
    const cache = await getInsightsCache();
    return cache.workflows;
  } catch (error) {
    console.error('[Main] Error getting workflow patterns:', error);
    return [];
  }
});

// Get rule suggestions
ipcMain.handle('get-rule-suggestions', async () => {
  try {
    const cache = await getInsightsCache();
    return cache.suggestions;
  } catch (error) {
    console.error('[Main] Error getting rule suggestions:', error);
    return [];
  }
});

// Get config health analysis
ipcMain.handle('get-config-health', async () => {
  try {
    const cache = await getInsightsCache();
    return cache.configHealth;
  } catch (error) {
    console.error('[Main] Error getting config health:', error);
    return {
      score: 100,
      issues: [],
      lastChecked: new Date().toISOString(),
    };
  }
});

// Force refresh all insights
ipcMain.handle('refresh-insights', async () => {
  try {
    const cache = await refreshInsightsCache();
    return generateInsightsSummary(
      cache.corrections,
      cache.workflows,
      cache.suggestions,
      cache.configHealth
    );
  } catch (error) {
    console.error('[Main] Error refreshing insights:', error);
    throw error;
  }
});

// Get tool usage statistics
ipcMain.handle('get-tool-usage-stats', async () => {
  try {
    return getToolUsageStats();
  } catch (error) {
    console.error('[Main] Error getting tool usage stats:', error);
    return [];
  }
});

// Get file modification frequency
ipcMain.handle('get-file-modification-frequency', async (_event, limit?: number) => {
  try {
    return getFileModificationFrequency(limit);
  } catch (error) {
    console.error('[Main] Error getting file modification frequency:', error);
    return [];
  }
});

// ============================================================
// Terminal Launcher IPC Handlers
// ============================================================

// Open session in external terminal (smart: attach if active, resume if stale)
ipcMain.handle('open-session-terminal', async (_event, session: Session, tmuxSessionName?: string) => {
  try {
    return await openSessionTerminal(session, tmuxSessionName);
  } catch (error) {
    console.error('[Main] Error opening session terminal:', error);
    return {
      success: false,
      action: 'attached' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================================
// Workspace IPC Handlers
// ============================================================

// Create a new workspace
ipcMain.handle('create-workspace', async (_event, options: CreateWorkspaceOptions) => {
  try {
    return await createWorkspace(options);
  } catch (error) {
    console.error('[Main] Error creating workspace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Get all workspaces with session stats
ipcMain.handle('get-workspaces', async (_event, options?: { status?: 'active' | 'completed' }) => {
  try {
    return getWorkspacesWithStats(options);
  } catch (error) {
    console.error('[Main] Error getting workspaces:', error);
    return [];
  }
});

// Get a single workspace by ID
ipcMain.handle('get-workspace', async (_event, id: number) => {
  try {
    return getWorkspaceById(id);
  } catch (error) {
    console.error('[Main] Error getting workspace:', error);
    return null;
  }
});

// Get sessions belonging to a workspace
ipcMain.handle('get-workspace-sessions', async (_event, workspaceId: number) => {
  try {
    return getWorkspaceSessions(workspaceId);
  } catch (error) {
    console.error('[Main] Error getting workspace sessions:', error);
    return [];
  }
});

// Complete a workspace
ipcMain.handle('complete-workspace', async (
  _event,
  workspaceId: number,
  options?: { killTmux?: boolean }
) => {
  try {
    return await completeWorkspace(workspaceId, options);
  } catch (error) {
    console.error('[Main] Error completing workspace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Attach to a workspace's tmux session
ipcMain.handle('attach-workspace', async (_event, workspaceId: number) => {
  try {
    return await attachToWorkspace(workspaceId);
  } catch (error) {
    console.error('[Main] Error attaching to workspace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Restore a workspace's tmux session
ipcMain.handle('restore-workspace', async (_event, workspaceId: number) => {
  try {
    return await restoreWorkspace(workspaceId);
  } catch (error) {
    console.error('[Main] Error restoring workspace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Delete a workspace
ipcMain.handle('delete-workspace', async (
  _event,
  workspaceId: number,
  options?: { killTmux?: boolean }
) => {
  try {
    return await deleteWorkspaceWithCleanup(workspaceId, options);
  } catch (error) {
    console.error('[Main] Error deleting workspace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================================
// AI Search IPC Handlers
// ============================================================

// AI-powered search across sessions and ledgers
ipcMain.handle('ai-search', async (_event, options: AISearchQuery) => {
  try {
    return await aiSearch(options);
  } catch (error) {
    console.error('[Main] Error in AI search:', error);
    return {
      query: options.query,
      matches: [],
      summary: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      searchedAt: new Date().toISOString(),
      durationMs: 0,
      tier: 'ai',
    };
  }
});

// Hybrid search (FTS5 + AI fallback)
ipcMain.handle('hybrid-search', async (_event, query: string, projectFilter?: string) => {
  try {
    return await hybridSearch(query, projectFilter);
  } catch (error) {
    console.error('[Main] Error in hybrid search:', error);
    return {
      query,
      matches: [],
      summary: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      searchedAt: new Date().toISOString(),
      durationMs: 0,
      tier: 'fts',
    };
  }
});

// Get distinct project paths (AI search variant - returns string[])
ipcMain.handle('get-distinct-project-paths', async () => {
  try {
    return await getDistinctProjectPaths();
  } catch (error) {
    console.error('[Main] Error getting distinct project paths:', error);
    return [];
  }
});

// ============================================================
// Tmux Management IPC Handlers
// ============================================================

// Get all tmux sessions with metadata
ipcMain.handle('get-tmux-sessions', async () => {
  try {
    return await getTmuxSessions();
  } catch (error) {
    console.error('[Main] Error getting tmux sessions:', error);
    return [];
  }
});

// Kill a tmux session by name
ipcMain.handle('kill-tmux-session', async (_event, name: string) => {
  try {
    return await killTmuxSession(name);
  } catch (error) {
    console.error('[Main] Error killing tmux session:', error);
    return false;
  }
});

// Rename a tmux session
ipcMain.handle('rename-tmux-session', async (_event, oldName: string, newName: string) => {
  try {
    return await renameTmuxSession(oldName, newName);
  } catch (error) {
    console.error('[Main] Error renaming tmux session:', error);
    return false;
  }
});

// Attach to a tmux session in external terminal
ipcMain.handle('attach-tmux-session', async (_event, name: string) => {
  try {
    return await openExternalTerminal(name);
  } catch (error) {
    console.error('[Main] Error attaching to tmux session:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});
