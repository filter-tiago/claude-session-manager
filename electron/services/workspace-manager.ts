/**
 * Workspace Manager Service
 *
 * Manages workspaces - named work contexts that group related Claude sessions.
 * A workspace links to a tmux session and automatically discovers sessions
 * created within its timeframe.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
  insertWorkspace,
  getWorkspaces,
  getWorkspace,
  getWorkspaceByName,
  updateWorkspace,
  deleteWorkspace as deleteWorkspaceDb,
  getWorkspaceSessions as getWorkspaceSessionsDb,
  type Workspace,
} from './database';
import { openExternalTerminal } from './terminal-launcher';
import type { Session } from '../../src/types/electron';

const execAsync = promisify(exec);

export type { Workspace };

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

// ============================================================
// Tmux Session Naming
// ============================================================

/**
 * Get the default tmux socket path for the current user
 */
function getTmuxSocketPath(): string {
  const uid = process.getuid?.() ?? 501;
  return `/private/tmp/tmux-${uid}/default`;
}

/**
 * Check if a tmux session exists
 * Uses explicit socket path for reliability from Electron context
 */
async function tmuxSessionExists(sessionName: string): Promise<boolean> {
  const socketPath = getTmuxSocketPath();
  try {
    const { stdout } = await execAsync(
      `tmux -S "${socketPath}" list-sessions -F "#{session_name}" 2>/dev/null`
    );
    const sessions = stdout.trim().split('\n').filter(Boolean);
    const exists = sessions.includes(sessionName);
    console.log(`[Workspace] Session check "${sessionName}": ${exists ? 'exists' : 'not found'} (sessions: ${sessions.join(', ')})`);
    return exists;
  } catch (error) {
    console.log(`[Workspace] Session check "${sessionName}": tmux not running or error`);
    return false;
  }
}

/**
 * Generate a unique tmux session name using try-create-catch-duplicate pattern
 *
 * This approach is more robust than check-then-create because tmuxSessionExists()
 * can return false positives in Electron's spawned process context.
 *
 * Tries: name → name-project → name-project-N
 * Returns the name of the session that was successfully created (or already exists)
 */
async function generateUniqueTmuxName(
  workspaceName: string,
  projectPath: string
): Promise<string> {
  const socketPath = getTmuxSocketPath();

  // Sanitize workspace name for tmux
  const baseName = workspaceName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 32);

  // Extract project name for compound naming
  const projectName = projectPath.split('/').pop() || 'project';
  const sanitizedProject = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');

  const withProject = `${baseName}-${sanitizedProject}`
    .substring(0, 32)
    .replace(/-+$/, '');

  // Candidates in priority order
  const candidates = [
    baseName,
    withProject,
    ...Array.from({ length: 9 }, (_, i) =>
      `${withProject}-${i + 2}`.substring(0, 32)
    ),
  ];

  for (const name of candidates) {
    try {
      await execAsync(
        `tmux -S "${socketPath}" new-session -d -s "${name}" -c "${projectPath}"`
      );
      console.log(`[Workspace] Created tmux session: ${name}`);
      return name;
    } catch (error: unknown) {
      const err = error as { message?: string; stderr?: string };
      const msg = err.message || '';
      const stderr = err.stderr || '';

      if (msg.includes('duplicate session') || stderr.includes('duplicate session')) {
        console.log(`[Workspace] Session "${name}" exists, trying next`);
        continue;
      }
      throw error;
    }
  }

  // All candidates taken - reuse the base name (it exists)
  console.log(`[Workspace] All slots taken, reusing: ${baseName}`);
  return baseName;
}

// ============================================================
// Workspace Operations
// ============================================================

/**
 * Create a new workspace with optional tmux session and Claude start
 */
export async function createWorkspace(
  options: CreateWorkspaceOptions
): Promise<CreateWorkspaceResult> {
  try {
    // Check if workspace with this name already exists in DB
    const existing = getWorkspaceByName(options.name);
    if (existing) {
      return {
        success: false,
        error: `Workspace "${options.name}" already exists`,
      };
    }

    // Generate unique name by trying to create (handles duplicates internally)
    // This also creates the tmux session as a side effect
    const tmuxSessionName = await generateUniqueTmuxName(
      options.name,
      options.projectPath
    );

    // Insert workspace into database
    const workspaceData: Omit<Workspace, 'id'> = {
      name: options.name,
      project_path: options.projectPath,
      tmux_session: tmuxSessionName,
      description: options.description || null,
      created_at: new Date().toISOString(),
      completed_at: null,
      status: 'active',
    };

    const workspaceId = insertWorkspace(workspaceData);
    const workspace = getWorkspace(workspaceId);

    if (!workspace) {
      return {
        success: false,
        error: 'Failed to retrieve created workspace',
      };
    }

    // Optionally start Claude in the tmux session
    if (options.startClaude) {
      const socketPath = getTmuxSocketPath();
      await execAsync(
        `tmux -S "${socketPath}" send-keys -t "${tmuxSessionName}:0.0" 'claude' Enter`
      );
    }

    return {
      success: true,
      workspace,
    };
  } catch (error) {
    console.error('[Workspace] Failed to create workspace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all workspaces with computed session statistics
 */
export function getWorkspacesWithStats(
  options?: { status?: 'active' | 'completed' }
): WorkspaceWithStats[] {
  const workspaces = getWorkspaces(options);

  return workspaces.map((workspace) => {
    const sessions = getWorkspaceSessionsDb(workspace.id);

    const session_count = sessions.length;
    const total_messages = sessions.reduce(
      (sum, s) => sum + (s.message_count || 0),
      0
    );

    return {
      ...workspace,
      session_count,
      total_messages,
    };
  });
}

/**
 * Get sessions that belong to a workspace
 */
export function getWorkspaceSessions(workspaceId: number): Session[] {
  return getWorkspaceSessionsDb(workspaceId);
}

/**
 * Complete a workspace - mark as done and optionally kill tmux session
 */
export async function completeWorkspace(
  workspaceId: number,
  options?: { killTmux?: boolean }
): Promise<CompleteWorkspaceResult> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found',
      };
    }

    // Get stats before completing
    const sessions = getWorkspaceSessionsDb(workspaceId);
    const stats = {
      sessions: sessions.length,
      messages: sessions.reduce((sum, s) => sum + (s.message_count || 0), 0),
    };

    // Update workspace
    updateWorkspace(workspaceId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    // Optionally kill tmux session
    if (options?.killTmux && workspace.tmux_session) {
      try {
        const socketPath = getTmuxSocketPath();
        await execAsync(`tmux -S "${socketPath}" kill-session -t "${workspace.tmux_session}" 2>/dev/null`);
      } catch {
        // Session might already be gone
      }
    }

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error('[Workspace] Failed to complete workspace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Attach to a workspace's tmux session in external terminal
 */
export async function attachToWorkspace(
  workspaceId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    if (!workspace.tmux_session) {
      return { success: false, error: 'Workspace has no tmux session' };
    }

    // Check if tmux session exists
    const exists = await tmuxSessionExists(workspace.tmux_session);
    if (!exists) {
      return {
        success: false,
        error: `tmux session "${workspace.tmux_session}" not found. Try restoring the workspace.`,
      };
    }

    // Open external terminal attached to the tmux session
    return await openExternalTerminal(workspace.tmux_session);
  } catch (error) {
    console.error('[Workspace] Failed to attach to workspace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Restore a workspace's tmux session after system reboot
 */
export async function restoreWorkspace(
  workspaceId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    if (!workspace.tmux_session) {
      return { success: false, error: 'Workspace has no tmux session name' };
    }

    // Check if session already exists
    const exists = await tmuxSessionExists(workspace.tmux_session);
    if (exists) {
      return { success: true }; // Already restored
    }

    // Recreate the tmux session
    const socketPath = getTmuxSocketPath();
    await execAsync(
      `tmux -S "${socketPath}" new-session -d -s "${workspace.tmux_session}" -c "${workspace.project_path}"`
    );

    return { success: true };
  } catch (error) {
    console.error('[Workspace] Failed to restore workspace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a workspace (does not kill tmux session by default)
 */
export async function deleteWorkspaceWithCleanup(
  workspaceId: number,
  options?: { killTmux?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Optionally kill tmux session
    if (options?.killTmux && workspace.tmux_session) {
      try {
        const socketPath = getTmuxSocketPath();
        await execAsync(`tmux -S "${socketPath}" kill-session -t "${workspace.tmux_session}" 2>/dev/null`);
      } catch {
        // Session might not exist
      }
    }

    // Delete from database
    deleteWorkspaceDb(workspaceId);

    return { success: true };
  } catch (error) {
    console.error('[Workspace] Failed to delete workspace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Re-export database functions for direct access
 */
export { getWorkspace, getWorkspaceByName, getWorkspaces, updateWorkspace };
