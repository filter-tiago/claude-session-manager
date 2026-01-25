/**
 * tmux Mapper for Claude Session Manager
 *
 * Maps tmux panes to Claude sessions by:
 * - Finding Claude processes running in tmux panes
 * - Matching processes to sessions via PID, cwd, or timing
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getSessions, updateSessionTmux } from './database';
import type { TmuxPane, Session } from '../../src/types/electron';

const execAsync = promisify(exec);

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
    // Format: session_name:window_index.pane_index pane_pid pane_current_path
    const { stdout } = await execAsync(
      'tmux list-panes -a -F "#{session_name}:#{window_index}.#{pane_index} #{pane_pid} #{pane_current_path}"'
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

    if (claudePids.length === 0) {
      // No Claude process in this pane
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

        // Update session with tmux info
        updateSessionTmux(
          matchedSession.session_id,
          pane.session,
          `${pane.window}.${pane.pane}`,
          pane.pid
        );
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
    const target = `${pane.session}:${pane.window}.${pane.pane}`;
    await execAsync(`tmux select-window -t "${pane.session}:${pane.window}"`);
    await execAsync(`tmux select-pane -t "${target}"`);
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
    // Determine target tmux session
    const tmuxSession = options?.tmuxSession || 'claude';

    // Check if tmux session exists, create if not
    try {
      await execAsync(`tmux has-session -t ${tmuxSession} 2>/dev/null`);
    } catch {
      // Session doesn't exist, create it
      await execAsync(`tmux new-session -d -s ${tmuxSession} -c "${projectPath}"`);
    }

    // Create a new window in the session
    const { stdout: windowIndex } = await execAsync(
      `tmux new-window -t ${tmuxSession} -c "${projectPath}" -P -F "#{window_index}"`
    );

    // Build the claude command
    let claudeCmd = 'claude';
    if (options?.ledger) {
      claudeCmd += ` --resume ${options.ledger}`;
    }
    if (options?.task) {
      // Escape the task for shell
      const escapedTask = options.task.replace(/'/g, "'\"'\"'");
      claudeCmd += ` '${escapedTask}'`;
    }

    // Send the claude command to the new pane
    const target = `${tmuxSession}:${windowIndex.trim()}.0`;
    await execAsync(`tmux send-keys -t "${target}" '${claudeCmd}' Enter`);

    // Get pane info
    const { stdout: paneInfo } = await execAsync(
      `tmux list-panes -t "${target}" -F "#{pane_pid}" | head -1`
    );

    const pane: TmuxPane = {
      session: tmuxSession,
      window: parseInt(windowIndex.trim(), 10),
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
    const target = `${pane.session}:${pane.window}.${pane.pane}`;
    await execAsync(`tmux send-keys -t "${target}" '${command}' Enter`);
    return true;
  } catch (error) {
    console.error('[tmux Mapper] Failed to send to pane:', error);
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
