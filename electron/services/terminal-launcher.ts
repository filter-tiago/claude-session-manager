/**
 * Terminal Launcher Service
 *
 * Smart terminal opening that handles:
 * - Active sessions: attach to existing tmux pane
 * - Stale sessions: resume in new pane
 * - Orphaned sessions: resume in new pane
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { Session } from '../../src/types/electron';
import { spawnClaudeSession } from './tmux-mapper';

const execAsync = promisify(exec);

/**
 * Get the default tmux socket path for the current user
 */
function getTmuxSocketPath(): string {
  const uid = process.getuid?.() ?? 501;
  return `/private/tmp/tmux-${uid}/default`;
}

export type TerminalApp = 'iterm' | 'terminal';

export interface OpenResult {
  success: boolean;
  action: 'attached' | 'resumed';
  pane?: string;
  error?: string;
}

/**
 * Detect the preferred terminal app on macOS
 * Prefers iTerm2 if installed, falls back to Terminal.app
 */
export async function detectTerminalApp(): Promise<TerminalApp> {
  try {
    // Check both system and user Applications directories
    await execAsync('test -d "/Applications/iTerm.app" || test -d "$HOME/Applications/iTerm.app"');
    return 'iterm';
  } catch {
    return 'terminal';
  }
}

/**
 * Verify that a tmux pane exists
 */
export async function verifyTmuxPane(
  tmuxSession: string,
  tmuxPane: string
): Promise<boolean> {
  try {
    const socketPath = getTmuxSocketPath();
    const target = `${tmuxSession}:${tmuxPane}`;
    await execAsync(`tmux -S "${socketPath}" has-session -t "${tmuxSession}" 2>/dev/null`);
    // Check if the specific pane exists
    await execAsync(`tmux -S "${socketPath}" list-panes -t "${target}" 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify that a process with the given PID is running and is claude
 */
export async function verifyProcess(pid: number | undefined): Promise<boolean> {
  if (!pid) return false;

  try {
    // Check if process exists
    const { stdout } = await execAsync(`ps -p ${pid} -o comm= 2>/dev/null || echo ""`);
    if (!stdout.trim()) return false;

    // Check if it's a claude process (could be node running claude)
    const { stdout: cmdline } = await execAsync(
      `ps -p ${pid} -o command= 2>/dev/null || echo ""`
    );
    return cmdline.includes('claude');
  } catch {
    return false;
  }
}

/**
 * Open an external terminal attached to a tmux session/pane
 */
export async function openExternalTerminal(
  tmuxSession: string
): Promise<{ success: boolean; error?: string }> {
  const terminalApp = await detectTerminalApp();

  try {
    const tmuxCmd = `tmux attach-session -t \\"${tmuxSession}\\"`;

    if (terminalApp === 'iterm') {
      // Open in iTerm2 using write text so shell $PATH is available
      const script = `
        tell application "iTerm"
          activate
          set newWindow to (create window with default profile)
          tell current session of newWindow
            write text "${tmuxCmd}"
          end tell
        end tell
      `;
      await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
    } else {
      // Open in Terminal.app
      const script = `
        tell application "Terminal"
          activate
          do script "${tmuxCmd}"
        end tell
      `;
      await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open terminal',
    };
  }
}

/**
 * Resume a session in a new tmux pane
 */
export async function resumeInNewPane(
  sessionId: string,
  projectPath: string,
  tmuxSessionName?: string
): Promise<{ success: boolean; pane?: string; error?: string }> {
  try {
    // Use the existing spawnClaudeSession with --resume flag
    const result = await spawnClaudeSession(projectPath, {
      ledger: sessionId,
      tmuxSession: tmuxSessionName,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const pane = result.pane
      ? `${result.pane.session}:${result.pane.window}.${result.pane.pane}`
      : undefined;

    // Open the new pane in external terminal
    if (result.pane) {
      const tmuxSession = result.pane.session;

      const terminalApp = await detectTerminalApp();
      const tmuxCmd = `tmux attach-session -t \\"${tmuxSession}\\"`;

      if (terminalApp === 'iterm') {
        const script = `
          tell application "iTerm"
            activate
            set newWindow to (create window with default profile)
            tell current session of newWindow
              write text "${tmuxCmd}"
            end tell
          end tell
        `;
        await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
      } else {
        const script = `
          tell application "Terminal"
            activate
            do script "${tmuxCmd}"
          end tell
        `;
        await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
      }
    }

    return { success: true, pane };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume session',
    };
  }
}

/**
 * Main entry point: Smart open session in external terminal
 *
 * Logic:
 * 1. If session has valid tmux mapping AND claude is running → attach
 * 2. Otherwise → resume in new pane
 */
export async function openSessionTerminal(session: Session, tmuxSessionName?: string): Promise<OpenResult> {
  console.log(`[Terminal Launcher] Opening session ${session.session_id.substring(0, 8)}`);

  // Check if session has tmux mapping
  if (session.tmux_session && session.tmux_pane) {
    console.log(`[Terminal Launcher] Found tmux mapping: ${session.tmux_session}:${session.tmux_pane}`);

    // Verify the pane still exists
    const paneExists = await verifyTmuxPane(session.tmux_session, session.tmux_pane);
    console.log(`[Terminal Launcher] Pane exists: ${paneExists}`);

    if (paneExists) {
      // Verify claude process is still running
      const claudeRunning = await verifyProcess(session.tmux_pane_pid);
      console.log(`[Terminal Launcher] Claude running: ${claudeRunning} (pid: ${session.tmux_pane_pid})`);

      if (claudeRunning) {
        // Active session - attach directly to the tmux session
        const result = await openExternalTerminal(session.tmux_session);
        return {
          success: result.success,
          action: 'attached',
          pane: `${session.tmux_session}:${session.tmux_pane}`,
          error: result.error,
        };
      }
    }
  }

  // No valid mapping or stale - resume in new pane
  console.log(`[Terminal Launcher] No valid mapping, resuming session`);
  const result = await resumeInNewPane(session.session_id, session.project_path, tmuxSessionName);

  return {
    success: result.success,
    action: 'resumed',
    pane: result.pane,
    error: result.error,
  };
}
