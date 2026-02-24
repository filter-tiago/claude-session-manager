/**
 * PTY Manager Service
 *
 * Manages pseudo-terminal sessions attached to tmux panes.
 * Since tmux panes aren't directly accessible as PTYs, we spawn a shell
 * that uses tmux capture-pane for output and tmux send-keys for input.
 */

import * as pty from 'node-pty';
import type { BrowserWindow } from 'electron';
import { spawn, execSync } from 'child_process';

/**
 * Get the default tmux socket path for the current user
 */
function getTmuxSocketPath(): string {
  const uid = process.getuid?.() ?? 501;
  return `/private/tmp/tmux-${uid}/default`;
}

// Platform-specific shell
const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

interface PtySession {
  pty: pty.IPty;
  sessionId: string;
  tmuxSession: string;
  tmuxPane: string;
  cols: number;
  rows: number;
}

// Track active PTY sessions
const activeSessions = new Map<string, PtySession>();

// Reference to main window for sending output
let mainWindowRef: BrowserWindow | null = null;

/**
 * Initialize the PTY manager with a reference to the main window
 */
export function initPtyManager(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;
}

/**
 * Attach to a tmux pane and stream its output
 */
export async function attachToPane(
  sessionId: string,
  tmuxSession: string,
  tmuxPane: string,
  cols: number = 80,
  rows: number = 24
): Promise<{ success: boolean; error?: string }> {
  // Check if already attached
  if (activeSessions.has(sessionId)) {
    console.log(`[PTY] Session ${sessionId} already attached`);
    return { success: true };
  }

  const socketPath = getTmuxSocketPath();

  // Verify tmux session exists
  try {
    execSync(`tmux -S "${socketPath}" has-session -t ${tmuxSession} 2>/dev/null`, { stdio: 'ignore' });
  } catch {
    return { success: false, error: `tmux session "${tmuxSession}" not found` };
  }

  const target = `${tmuxSession}:${tmuxPane}`;

  // Verify tmux pane exists (more specific check)
  try {
    execSync(`tmux -S "${socketPath}" list-panes -t ${target} 2>/dev/null`, { stdio: 'ignore' });
  } catch {
    return { success: false, error: `tmux pane "${target}" not found` };
  }

  try {
    // Spawn a shell that monitors the tmux pane
    // We use a script that:
    // 1. Continuously captures pane output
    // 2. Forwards stdin to tmux send-keys
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        TMUX_TARGET: target,
      },
    });

    // Start the tmux monitoring script
    // This approach uses tail -f on a named pipe with tmux capture
    const monitorScript = `
# Clear screen and position cursor
printf '\\033[2J\\033[H'

# Target pane
TARGET="${target}"
SOCKET="${socketPath}"

# Function to capture pane content
capture_pane() {
  tmux -S "$SOCKET" capture-pane -t "$TARGET" -p -e -S - 2>/dev/null
}

# Initial capture with empty check
INITIAL=$(capture_pane)
if [ -z "$INITIAL" ] || [ -z "$(echo "$INITIAL" | tr -d '[:space:]')" ]; then
  echo "[Waiting for session output...]"
else
  echo "$INITIAL"
fi

# Track last capture for diff
LAST_LINES=$(echo "$INITIAL" | wc -l)

# Monitor loop - captures and displays new content
while true; do
  sleep 0.1

  # Check if pane still exists
  if ! tmux -S "$SOCKET" has-session -t "${tmuxSession}" 2>/dev/null; then
    echo "[Session ended]"
    break
  fi

  # Get current content
  CURRENT=$(capture_pane)
  CURRENT_LINES=$(echo "$CURRENT" | wc -l)

  # If content changed, show new lines
  if [ "$CURRENT_LINES" -gt "$LAST_LINES" ]; then
    echo "$CURRENT" | tail -n +$((LAST_LINES + 1))
    LAST_LINES=$CURRENT_LINES
  fi
done
`;

    // Send the monitor script to the PTY
    ptyProcess.write(monitorScript + '\n');

    // Handle PTY output - send to renderer
    ptyProcess.onData((data: string) => {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('terminal-output', sessionId, data);
      }
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[PTY] Session ${sessionId} exited: code=${exitCode}, signal=${signal}`);
      activeSessions.delete(sessionId);
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('terminal-exit', sessionId, exitCode);
      }
    });

    // Store the session
    activeSessions.set(sessionId, {
      pty: ptyProcess,
      sessionId,
      tmuxSession,
      tmuxPane,
      cols,
      rows,
    });

    console.log(`[PTY] Attached to ${target} for session ${sessionId}`);
    return { success: true };
  } catch (error) {
    console.error(`[PTY] Failed to attach to ${target}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to spawn PTY',
    };
  }
}

/**
 * Improved approach: Use script + tmux capture-pane for clean output
 * This streams pane content without the tmux chrome
 */
export async function attachToPaneDirect(
  sessionId: string,
  tmuxSession: string,
  tmuxPane: string,
  cols: number = 80,
  rows: number = 24
): Promise<{ success: boolean; error?: string }> {
  // Check if already attached
  if (activeSessions.has(sessionId)) {
    console.log(`[PTY] Session ${sessionId} already attached`);
    return { success: true };
  }

  const target = `${tmuxSession}:${tmuxPane}`;
  const socketPath = getTmuxSocketPath();

  // Verify tmux session exists
  try {
    execSync(`tmux -S "${socketPath}" has-session -t ${tmuxSession} 2>/dev/null`, { stdio: 'ignore' });
  } catch {
    return { success: false, error: `tmux session "${tmuxSession}" not found` };
  }

  // Verify tmux pane exists (more specific check)
  try {
    execSync(`tmux -S "${socketPath}" list-panes -t ${target} 2>/dev/null`, { stdio: 'ignore' });
  } catch {
    return { success: false, error: `tmux pane "${target}" not found` };
  }

  try {
    // Spawn a PTY with a script that:
    // 1. Does an initial full capture
    // 2. Then polls for changes using capture-pane
    // Build the monitoring script that captures pane content with ANSI colors and polls for updates
    const monitorScript = `
# Terminal monitor for ${target}
export TARGET="${target}"
export TMUX_SESSION="${tmuxSession}"
export SOCKET="${socketPath}"

# Function to capture pane with escape codes
capture() {
  tmux -S "$SOCKET" capture-pane -t "$TARGET" -p -e -S -50 2>/dev/null
}

# Function to read cursor position (x y)
cursor_pos() {
  tmux -S "$SOCKET" display-message -p -t "$TARGET" "#{cursor_x} #{cursor_y}" 2>/dev/null
}

# Initial capture - get last 50 lines with colors
INITIAL=$(capture)
if [ -z "$INITIAL" ] || [ -z "$(echo "$INITIAL" | tr -d '[:space:]')" ]; then
  echo "[Waiting for session output...]"
else
  echo "$INITIAL"
fi

# Hash of last content to detect changes
LAST_HASH=""
# Last cursor position
LAST_CURSOR=""

# Monitor loop
while true; do
  sleep 0.2

  # Check if session still exists
  if ! tmux -S "$SOCKET" has-session -t "$TMUX_SESSION" 2>/dev/null; then
    echo ""
    echo "[Session ended]"
    exit 0
  fi

  # Capture current content
  CONTENT=$(capture)
  HASH=$(echo "$CONTENT" | cksum)
  CURSOR=$(cursor_pos)

  # Redraw if content changed
  if [ "$HASH" != "$LAST_HASH" ]; then
    printf '\\033[2J\\033[H'  # Clear screen and move to top
    echo "$CONTENT"
    LAST_HASH="$HASH"
  fi

  # Update cursor if position changed (or after redraw)
  if [ "$CURSOR" != "$LAST_CURSOR" ]; then
    if [ -n "$CURSOR" ]; then
      X=$(echo "$CURSOR" | awk '{print $1}')
      Y=$(echo "$CURSOR" | awk '{print $2}')
      if [ -n "$X" ] && [ -n "$Y" ]; then
        printf '\\033[%d;%dH' $((Y + 1)) $((X + 1))
      fi
    fi
    LAST_CURSOR="$CURSOR"
  fi
done
`;

    // Spawn PTY with the monitoring script passed via -c flag
    // This avoids bash echoing the script source as it would when writing to stdin
    const ptyProcess = pty.spawn(shell, ['-c', monitorScript], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
    });

    // Handle PTY output - send to renderer
    ptyProcess.onData((data: string) => {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('terminal-output', sessionId, data);
      }
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[PTY] Session ${sessionId} exited: code=${exitCode}, signal=${signal}`);
      activeSessions.delete(sessionId);
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('terminal-exit', sessionId, exitCode);
      }
    });

    // Store the session
    activeSessions.set(sessionId, {
      pty: ptyProcess,
      sessionId,
      tmuxSession,
      tmuxPane,
      cols,
      rows,
    });

    console.log(`[PTY] Attached to ${target} for session ${sessionId} with monitor script`);
    return { success: true };
  } catch (error) {
    console.error(`[PTY] Failed to attach to ${target}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to attach to tmux',
    };
  }
}

/**
 * Send input to a PTY session (which forwards to tmux)
 */
export function sendInput(sessionId: string, data: string): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.warn(`[PTY] No active session for ${sessionId}`);
    return false;
  }

  try {
    // For the monitor script approach, we need to use tmux send-keys directly
    // because the script is read-only
    const socketPath = getTmuxSocketPath();
    const target = `${session.tmuxSession}:${session.tmuxPane}`;

    // Use spawn to avoid shell escaping issues
    const child = spawn('tmux', ['-S', socketPath, 'send-keys', '-t', target, '-l', data]);
    child.on('error', (err) => {
      console.error(`[PTY] Failed to send keys to ${target}:`, err);
    });

    return true;
  } catch (error) {
    console.error(`[PTY] Error sending input to ${sessionId}:`, error);
    return false;
  }
}

/**
 * Send special keys (Enter, Escape, etc.) to a PTY session
 */
export function sendSpecialKey(sessionId: string, key: string): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.warn(`[PTY] No active session for ${sessionId}`);
    return false;
  }

  try {
    const socketPath = getTmuxSocketPath();
    const target = `${session.tmuxSession}:${session.tmuxPane}`;

    // tmux key names: Enter, Escape, Tab, Space, BSpace, etc.
    spawn('tmux', ['-S', socketPath, 'send-keys', '-t', target, key]);

    return true;
  } catch (error) {
    console.error(`[PTY] Error sending special key to ${sessionId}:`, error);
    return false;
  }
}

/**
 * Resize a PTY session
 */
export function resizePty(sessionId: string, cols: number, rows: number): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.warn(`[PTY] No active session for ${sessionId}`);
    return false;
  }

  try {
    session.pty.resize(cols, rows);
    session.cols = cols;
    session.rows = rows;
    console.log(`[PTY] Resized ${sessionId} to ${cols}x${rows}`);
    return true;
  } catch (error) {
    console.error(`[PTY] Error resizing ${sessionId}:`, error);
    return false;
  }
}

/**
 * Detach from a PTY session
 */
export function detachPty(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return;
  }

  try {
    session.pty.kill();
  } catch (error) {
    console.error(`[PTY] Error killing PTY for ${sessionId}:`, error);
  }

  activeSessions.delete(sessionId);
  console.log(`[PTY] Detached from ${sessionId}`);
}

/**
 * Get active session count
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}

/**
 * Capture a snapshot of a tmux pane's content (last 50 lines with ANSI escape codes)
 */
export async function capturePaneSnapshot(tmuxSession: string, tmuxPane: string): Promise<string> {
  const socketPath = getTmuxSocketPath();
  return new Promise((resolve, reject) => {
    const proc = spawn('tmux', ['-S', socketPath, 'capture-pane', '-p', '-t', `${tmuxSession}:${tmuxPane}`, '-e'], {
      encoding: 'utf-8'
    } as any);
    let output = '';
    proc.stdout.on('data', (data: string) => { output += data; });
    proc.stderr.on('data', () => {});
    proc.on('close', (code: number) => {
      if (code === 0) {
        // Return last 50 lines
        const lines = output.split('\n');
        resolve(lines.slice(-50).join('\n'));
      } else {
        reject(new Error(`capture-pane failed with code ${code}`));
      }
    });
  });
}

/**
 * Check if a session is attached
 */
export function isSessionAttached(sessionId: string): boolean {
  return activeSessions.has(sessionId);
}

/**
 * Cleanup all PTY sessions (call on app quit)
 */
export function cleanupAllPtys(): void {
  console.log(`[PTY] Cleaning up ${activeSessions.size} active sessions`);

  for (const [sessionId, session] of activeSessions) {
    try {
      session.pty.kill();
    } catch (error) {
      console.error(`[PTY] Error cleaning up ${sessionId}:`, error);
    }
  }

  activeSessions.clear();
  mainWindowRef = null;
}
