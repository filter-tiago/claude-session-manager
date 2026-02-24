/**
 * tmux Mapper for Claude Session Manager
 *
 * Maps tmux panes to Claude sessions by:
 * - Finding Claude processes running in tmux panes
 * - Matching processes to sessions via PID, cwd, or timing
 */

import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { getDb, getSessions, updateSessionTmux, updateSessionTmuxAlive } from './database';
import type { TmuxPane, Session } from '../../src/types/electron';

const execAsync = promisify(exec);

/**
 * Get the default tmux socket path for the current user
 */
function getTmuxSocketPath(): string {
  const uid = process.getuid?.() ?? 501;
  return `/private/tmp/tmux-${uid}/default`;
}

// Generate default tmux session name from project path
// e.g. claude-session-manager → csm
export function generateDefaultTmuxName(projectPath: string): string {
  const basename = path.basename(projectPath);
  return basename.split('-').map(s => s[0] || '').join('') || 'cc';
}

/**
 * Generate a unique tmux session name using try-create-catch-duplicate pattern
 * Returns the name of the session that was successfully created
 */
async function createUniqueTmuxSession(
  baseName: string,
  projectPath: string
): Promise<string> {
  const socketPath = getTmuxSocketPath();

  // Sanitize base name
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 32);

  // Candidates: name, name-2, name-3, ..., name-10
  const candidates = [
    sanitized,
    ...Array.from({ length: 9 }, (_, i) => `${sanitized}-${i + 2}`.substring(0, 32)),
  ];

  for (const name of candidates) {
    try {
      await execAsync(
        `tmux -S "${socketPath}" new-session -d -s "${name}" -c "${projectPath}"`
      );
      console.log(`[tmux Mapper] Created tmux session: ${name}`);
      return name;
    } catch (error: unknown) {
      const err = error as { message?: string; stderr?: string };
      const msg = err.message || '';
      const stderr = err.stderr || '';

      if (msg.includes('duplicate session') || stderr.includes('duplicate session')) {
        console.log(`[tmux Mapper] Session "${name}" exists, trying next`);
        continue;
      }
      throw error;
    }
  }

  // All candidates taken - this shouldn't happen, but return the base anyway
  console.warn(`[tmux Mapper] All session names taken, returning: ${sanitized}`);
  return sanitized;
}

// Cache of pane mappings
let paneCache: Map<string, string> = new Map(); // pane_id -> session_id
let lastMappingTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds

// ============================================================
// tmux Operations
// ============================================================

/**
 * Check if tmux is available
 */
export async function isTmuxAvailable(): Promise<boolean> {
  try {
    await execAsync('which tmux');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all tmux panes with their details
 */
export async function getTmuxPanes(): Promise<TmuxPane[]> {
  try {
    const socketPath = getTmuxSocketPath();
    // Format: session_name:window_index.pane_index pane_pid pane_current_path
    const { stdout } = await execAsync(
      `tmux -S "${socketPath}" list-panes -a -F "#{session_name}:#{window_index}.#{pane_index} #{pane_pid} #{pane_current_path}"`
    );

    const panes: TmuxPane[] = [];

    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue;

      const parts = line.split(' ');
      if (parts.length < 2) continue;

      const [location, pid, ...cwdParts] = parts;
      const [sessionAndWindow, paneIndex] = location.split('.');
      const [session, windowIndex] = sessionAndWindow.split(':');

      panes.push({
        session,
        window: parseInt(windowIndex, 10),
        pane: parseInt(paneIndex, 10),
        pid: parseInt(pid, 10),
        cwd: cwdParts.join(' ').trim() || undefined,
      });
    }

    return panes;
  } catch (error) {
    console.log('[tmux Mapper] Failed to list panes:', error);
    return [];
  }
}

/**
 * Get the full pane identifier string
 */
function getPaneId(pane: TmuxPane): string {
  return `${pane.session}:${pane.window}.${pane.pane}`;
}

/**
 * Find Claude processes running in a tmux pane
 * Returns PIDs of claude processes that are children of the pane's shell
 */
async function findClaudeProcesses(panePid: number): Promise<number[]> {
  try {
    // Find all child processes of the pane's shell that are claude
    const { stdout } = await execAsync(
      `pgrep -P ${panePid} -f "claude" 2>/dev/null || echo ""`
    );

    if (!stdout.trim()) {
      // Also check grandchildren (claude might be spawned by a script)
      const { stdout: childPids } = await execAsync(
        `pgrep -P ${panePid} 2>/dev/null || echo ""`
      );

      const claudePids: number[] = [];
      for (const childPid of childPids.trim().split('\n')) {
        if (!childPid.trim()) continue;
        try {
          const { stdout: grandchildPids } = await execAsync(
            `pgrep -P ${childPid} -f "claude" 2>/dev/null || echo ""`
          );
          for (const pid of grandchildPids.trim().split('\n')) {
            if (pid.trim()) {
              claudePids.push(parseInt(pid.trim(), 10));
            }
          }
        } catch {
          // Ignore errors
        }
      }
      return claudePids;
    }

    return stdout
      .trim()
      .split('\n')
      .filter((p) => p.trim())
      .map((p) => parseInt(p.trim(), 10));
  } catch {
    return [];
  }
}

/**
 * Get the working directory of a process
 */
async function getProcessCwd(pid: number): Promise<string | null> {
  try {
    // On macOS, use lsof to get the current working directory
    if (process.platform === 'darwin') {
      const { stdout } = await execAsync(`lsof -p ${pid} -Fn 2>/dev/null | grep "^n.*cwd" | head -1 | cut -c2-`);
      if (stdout.trim()) {
        return stdout.trim();
      }
      // Fallback: check for the most recently accessed directory
      const { stdout: pwdx } = await execAsync(`lsof -p ${pid} -Fn 2>/dev/null | grep "^n/" | head -1 | cut -c2-`);
      return pwdx.trim() || null;
    }
    // On Linux, read /proc/<pid>/cwd
    const { stdout } = await execAsync(`readlink -f /proc/${pid}/cwd 2>/dev/null`);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// ============================================================
// Session Mapping
// ============================================================

/**
 * Map all tmux panes to Claude sessions
 */
export async function mapAllPanes(): Promise<Map<string, string>> {
  const now = Date.now();

  // Return cache if still valid
  if (now - lastMappingTime < CACHE_TTL_MS && paneCache.size > 0) {
    return paneCache;
  }

  const newCache = new Map<string, string>();

  // Get all panes and sessions
  const panes = await getTmuxPanes();
  const sessions = getSessions();

  // Track sessions with live Claude processes
  const sessionsWithLiveClaude = new Set<string>();

  // Index sessions by project path for quick lookup
  const sessionsByPath = new Map<string, Session[]>();
  for (const session of sessions) {
    const existing = sessionsByPath.get(session.project_path) || [];
    existing.push(session);
    sessionsByPath.set(session.project_path, existing);
  }

  // For each pane, try to find a matching Claude session
  for (const pane of panes) {
    const paneId = getPaneId(pane);

    // Find Claude processes in this pane
    const claudePids = await findClaudeProcesses(pane.pid);
    const hasClaudeRunning = claudePids.length > 0;

    if (!hasClaudeRunning) {
      // No Claude process in this pane - check if any session was mapped here
      // and mark it as not alive
      for (const session of sessions) {
        if (session.tmux_session === pane.session &&
            session.tmux_pane === `${pane.window}.${pane.pane}`) {
          updateSessionTmuxAlive(session.session_id, false);
        }
      }
      continue;
    }

    // Get the working directory of the Claude process
    const claudeCwd = await getProcessCwd(claudePids[0]);

    if (claudeCwd) {
      // Find sessions with matching project path
      const matchingSessions = sessionsByPath.get(claudeCwd) || [];

      // Take the most recently active session
      const sorted = matchingSessions
        .filter((s) => s.status === 'active' || s.status === 'idle')
        .sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());

      if (sorted.length > 0) {
        const matchedSession = sorted[0];
        newCache.set(paneId, matchedSession.session_id);
        sessionsWithLiveClaude.add(matchedSession.session_id);

        // Update session with tmux info
        updateSessionTmux(
          matchedSession.session_id,
          pane.session,
          `${pane.window}.${pane.pane}`,
          pane.pid
        );

        // Mark session as having live Claude process
        updateSessionTmuxAlive(matchedSession.session_id, true);
      }
    }
  }

  // Update sessions that had tmux mapping but no longer have live Claude
  for (const session of sessions) {
    if (session.tmux_session && session.tmux_pane && !sessionsWithLiveClaude.has(session.session_id)) {
      // Session had a tmux mapping but wasn't matched to a live Claude
      // Check if the pane still exists
      const paneExists = panes.some(
        p => p.session === session.tmux_session &&
             `${p.window}.${p.pane}` === session.tmux_pane
      );

      if (!paneExists) {
        // Pane no longer exists - clear tmux mapping and mark as dead
        updateSessionTmux(session.session_id, null, null, null);
        updateSessionTmuxAlive(session.session_id, false);
      }
    }
  }

  // Update cache
  paneCache = newCache;
  lastMappingTime = now;

  return newCache;
}

/**
 * Get the session ID for a tmux pane
 */
export async function getSessionForPane(paneId: string): Promise<string | null> {
  const mappings = await mapAllPanes();
  return mappings.get(paneId) || null;
}

/**
 * Get the tmux pane for a session
 */
export async function getPaneForSession(sessionId: string): Promise<TmuxPane | null> {
  const mappings = await mapAllPanes();

  for (const [paneId, sid] of mappings) {
    if (sid === sessionId) {
      // Parse pane ID back to TmuxPane
      const [sessionAndWindow, paneIndex] = paneId.split('.');
      const [session, windowIndex] = sessionAndWindow.split(':');
      const panes = await getTmuxPanes();
      return panes.find(
        (p) => p.session === session &&
               p.window === parseInt(windowIndex, 10) &&
               p.pane === parseInt(paneIndex, 10)
      ) || null;
    }
  }

  return null;
}

// ============================================================
// tmux Actions
// ============================================================

/**
 * Focus a specific tmux pane
 */
export async function focusPane(pane: TmuxPane): Promise<boolean> {
  try {
    const socketPath = getTmuxSocketPath();
    const target = `${pane.session}:${pane.window}.${pane.pane}`;
    await execAsync(`tmux -S "${socketPath}" select-window -t "${pane.session}:${pane.window}"`);
    await execAsync(`tmux -S "${socketPath}" select-pane -t "${target}"`);
    return true;
  } catch (error) {
    console.error('[tmux Mapper] Failed to focus pane:', error);
    return false;
  }
}

/**
 * Spawn a new Claude session in a tmux pane
 */
export async function spawnClaudeSession(
  projectPath: string,
  options?: { task?: string; ledger?: string; tmuxSession?: string }
): Promise<{ success: boolean; error?: string; pane?: TmuxPane }> {
  try {
    const socketPath = getTmuxSocketPath();

    // Determine base tmux session name
    const baseName = options?.tmuxSession || generateDefaultTmuxName(projectPath);

    // Create a unique tmux session (handles duplicates automatically)
    const tmuxSession = await createUniqueTmuxSession(baseName, projectPath);

    // Build the claude command
    let claudeCmd = 'claude';
    if (options?.ledger) {
      claudeCmd += ` --resume ${options.ledger} --dangerously-skip-permissions`;
    }
    if (options?.task) {
      // Escape the task for shell
      const escapedTask = options.task.replace(/'/g, "'\"'\"'");
      claudeCmd += ` '${escapedTask}'`;
    }

    // Send the claude command to the new session's first pane
    const target = `${tmuxSession}:0.0`;
    await execAsync(`tmux -S "${socketPath}" send-keys -t "${target}" '${claudeCmd}' Enter`);

    // Get pane info
    const { stdout: paneInfo } = await execAsync(
      `tmux -S "${socketPath}" list-panes -t "${target}" -F "#{pane_pid}" | head -1`
    );

    const pane: TmuxPane = {
      session: tmuxSession,
      window: 0,
      pane: 0,
      pid: parseInt(paneInfo.trim(), 10),
      cwd: projectPath,
    };

    // Invalidate cache
    lastMappingTime = 0;

    return { success: true, pane };
  } catch (error) {
    console.error('[tmux Mapper] Failed to spawn session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a command to a tmux pane
 */
export async function sendToPane(pane: TmuxPane, command: string): Promise<boolean> {
  try {
    const socketPath = getTmuxSocketPath();
    const target = `${pane.session}:${pane.window}.${pane.pane}`;
    await execAsync(`tmux -S "${socketPath}" send-keys -t "${target}" '${command}' Enter`);
    return true;
  } catch (error) {
    console.error('[tmux Mapper] Failed to send to pane:', error);
    return false;
  }
}

// ============================================================
// tmux Session Management
// ============================================================

export interface TmuxSessionInfo {
  name: string;              // e.g., "csm", "ea-2"
  windows: number;
  panes: number;
  created: string;           // ISO timestamp
  attached: boolean;         // Currently attached?
  lastActivity: string;      // ISO timestamp
  size: string;              // e.g., "200x50"
  claudeSessions: string[];  // Mapped Claude session IDs from DB
}

/**
 * Get all tmux sessions with metadata and mapped Claude sessions
 */
export async function getTmuxSessions(): Promise<TmuxSessionInfo[]> {
  try {
    const socketPath = getTmuxSocketPath();

    // List all tmux sessions with relevant fields
    const { stdout } = await execAsync(
      `tmux -S "${socketPath}" list-sessions -F "#{session_name}|#{session_windows}|#{session_attached}|#{session_created}|#{session_activity}|#{session_width}x#{session_height}"`
    );

    if (!stdout.trim()) return [];

    const db = getDb();
    const sessions: TmuxSessionInfo[] = [];

    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue;

      const parts = line.split('|');
      if (parts.length < 6) continue;

      const [name, windowsStr, attachedStr, createdStr, activityStr, size] = parts;

      // Get pane count for this session
      let paneCount = 0;
      try {
        const { stdout: paneOutput } = await execAsync(
          `tmux -S "${socketPath}" list-panes -t "${name}" -F "#{pane_id}" 2>/dev/null`
        );
        paneCount = paneOutput.trim().split('\n').filter(l => l.trim()).length;
      } catch {
        // Fallback: estimate one pane per window
        paneCount = parseInt(windowsStr, 10) || 1;
      }

      // Convert unix timestamps to ISO strings
      const createdEpoch = parseInt(createdStr, 10);
      const activityEpoch = parseInt(activityStr, 10);
      const created = isNaN(createdEpoch)
        ? new Date().toISOString()
        : new Date(createdEpoch * 1000).toISOString();
      const lastActivity = isNaN(activityEpoch)
        ? new Date().toISOString()
        : new Date(activityEpoch * 1000).toISOString();

      // Cross-reference with database to find Claude sessions mapped to this tmux session
      const claudeSessions: string[] = [];
      try {
        const stmt = db.prepare(
          'SELECT session_id FROM sessions WHERE tmux_session = ?'
        );
        const rows = stmt.all(name) as Array<{ session_id: string }>;
        for (const row of rows) {
          claudeSessions.push(row.session_id);
        }
      } catch (err) {
        console.log(`[tmux Mapper] Failed to query Claude sessions for tmux session "${name}":`, err);
      }

      sessions.push({
        name,
        windows: parseInt(windowsStr, 10) || 0,
        panes: paneCount,
        created,
        attached: attachedStr === '1',
        lastActivity,
        size: size || '0x0',
        claudeSessions,
      });
    }

    // Sort by lastActivity descending (most recent first)
    sessions.sort((a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );

    return sessions;
  } catch (error) {
    // tmux server not running or other error → return empty array
    console.log('[tmux Mapper] Failed to list tmux sessions:', error);
    return [];
  }
}

/**
 * Kill a tmux session by name
 */
export async function killTmuxSession(sessionName: string): Promise<boolean> {
  try {
    const socketPath = getTmuxSocketPath();
    await execAsync(`tmux -S "${socketPath}" kill-session -t "${sessionName}"`);
    console.log(`[tmux Mapper] Killed tmux session: ${sessionName}`);
    return true;
  } catch (error) {
    console.log(`[tmux Mapper] Failed to kill tmux session "${sessionName}":`, error);
    return false;
  }
}

/**
 * Rename a tmux session and update all database references
 */
export async function renameTmuxSession(oldName: string, newName: string): Promise<boolean> {
  try {
    const socketPath = getTmuxSocketPath();
    await execAsync(`tmux -S "${socketPath}" rename-session -t "${oldName}" "${newName}"`);
    console.log(`[tmux Mapper] Renamed tmux session: ${oldName} → ${newName}`);

    // Update database: all sessions referencing the old tmux session name
    try {
      const db = getDb();
      const stmt = db.prepare('UPDATE sessions SET tmux_session = ? WHERE tmux_session = ?');
      const result = stmt.run(newName, oldName);
      console.log(`[tmux Mapper] Updated ${result.changes} database session(s) from "${oldName}" to "${newName}"`);
    } catch (dbError) {
      console.log(`[tmux Mapper] tmux rename succeeded but database update failed:`, dbError);
    }

    return true;
  } catch (error) {
    console.log(`[tmux Mapper] Failed to rename tmux session "${oldName}" to "${newName}":`, error);
    return false;
  }
}

// ============================================================
// Background Mapping
// ============================================================

let mappingInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic mapping of tmux panes to sessions
 */
export function startPeriodicMapping(intervalMs: number = 30000): void {
  if (mappingInterval) {
    return;
  }

  // Initial mapping
  mapAllPanes();

  // Periodic mapping
  mappingInterval = setInterval(() => {
    mapAllPanes();
  }, intervalMs);

  console.log('[tmux Mapper] Started periodic mapping');
}

/**
 * Stop periodic mapping
 */
export function stopPeriodicMapping(): void {
  if (mappingInterval) {
    clearInterval(mappingInterval);
    mappingInterval = null;
    console.log('[tmux Mapper] Stopped periodic mapping');
  }
}

// ============================================================
// Exports for testing
// ============================================================

export { findClaudeProcesses, getProcessCwd, getPaneId };
