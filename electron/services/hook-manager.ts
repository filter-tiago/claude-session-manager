/**
 * Hook Manager Service for Claude Session Manager
 *
 * Manages Claude Code hooks:
 * - Parse settings.json to list hooks
 * - Read hook script source
 * - Test hooks with mock input
 * - Enable/disable hooks
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import {
  readSettings,
  writeSettings,
  type HookConfig,
  type SettingsScope,
} from './config-manager';

// ============================================================
// Types
// ============================================================

export interface HookInfo {
  name: string;
  eventType: string;
  command: string;
  matcher?: string[];
  timeout?: number;
  source: 'global' | 'project';
  enabled: boolean;
  path?: string;
  index: number; // Index within the event type's hook array
  configIndex: number; // Index of the HookConfig within event type
}

export interface HookTestResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  durationMs: number;
}

// Hook event types supported by Claude Code
export const HOOK_EVENT_TYPES = [
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'SessionStart',
  'Stop',
  'SubagentStop',
] as const;

export type HookEventType = (typeof HOOK_EVENT_TYPES)[number];

// ============================================================
// Hook Discovery
// ============================================================

/**
 * Get all hooks from settings.json files
 * @param projectPath - Optional project path to include project-specific hooks
 * @returns Array of HookInfo objects
 */
export function getHooks(projectPath?: string): HookInfo[] {
  const hooks: HookInfo[] = [];

  // Get global hooks
  const globalSettings = readSettings('global');
  if (globalSettings.hooks) {
    extractHooksFromSettings(globalSettings.hooks, 'global', hooks);
  }

  // Get project hooks if path provided
  if (projectPath) {
    try {
      const projectSettings = readSettings('project', projectPath);
      if (projectSettings.hooks) {
        extractHooksFromSettings(projectSettings.hooks, 'project', hooks);
      }
    } catch (error) {
      console.warn('[HookManager] Error reading project settings:', error);
    }
  }

  return hooks;
}

/**
 * Extract hooks from a settings hooks object
 */
function extractHooksFromSettings(
  hooksConfig: Record<string, HookConfig[]>,
  source: 'global' | 'project',
  hooks: HookInfo[]
): void {
  for (const [eventType, hookConfigs] of Object.entries(hooksConfig)) {
    if (!Array.isArray(hookConfigs)) continue;

    hookConfigs.forEach((hookConfig, configIndex) => {
      if (!hookConfig.hooks || !Array.isArray(hookConfig.hooks)) return;

      hookConfig.hooks.forEach((hookDef, hookIndex) => {
        const hook: HookInfo = {
          name: extractHookName(hookDef.command),
          eventType,
          command: hookDef.command,
          matcher: hookConfig.matcher,
          timeout: hookDef.timeout,
          source,
          enabled: true, // If it's in the config, it's enabled
          path: extractHookPath(hookDef.command),
          index: hookIndex,
          configIndex,
        };
        hooks.push(hook);
      });
    });
  }
}

/**
 * Extract a readable name from a hook command
 */
function extractHookName(command: string): string {
  // Replace environment variables
  const expandedCommand = command.replace(/\$CLAUDE_PROJECT_DIR/g, '.');

  // Try to extract script name from command
  const parts = expandedCommand.split(/[\/\\]/);
  const lastPart = parts[parts.length - 1];

  // Remove common suffixes and extensions
  let name = lastPart
    .replace(/\.(sh|ts|js|py)$/, '')
    .replace(/-hook$/, '')
    .replace(/^hook-/, '');

  // Convert to title case
  name = name
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return name || 'Unknown Hook';
}

/**
 * Extract the script path from a hook command
 */
function extractHookPath(command: string): string | undefined {
  // Look for paths in the command
  // Handle patterns like: cat | /path/to/script.sh
  // Or: $CLAUDE_PROJECT_DIR/.claude/hooks/script.sh

  const patterns = [
    // Absolute paths
    /(?:^|\s|\|)\s*(\/[^\s|&;]+\.(sh|ts|js|py))/,
    // $CLAUDE_PROJECT_DIR paths
    /\$CLAUDE_PROJECT_DIR(\/[^\s|&;]+\.(sh|ts|js|py))/,
    // Paths with npx tsx
    /npx\s+tsx\s+([^\s|&;]+\.ts)/,
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

// ============================================================
// Hook Source Reading
// ============================================================

/**
 * Read the source code of a hook script
 * @param hookPath - Path to the hook script (may contain environment variables)
 * @param projectPath - Optional project path for $CLAUDE_PROJECT_DIR expansion
 * @returns The source code content
 */
export function getHookSource(hookPath: string, projectPath?: string): string {
  try {
    // Expand environment variables
    let expandedPath = hookPath;

    if (hookPath.includes('$CLAUDE_PROJECT_DIR') && projectPath) {
      expandedPath = hookPath.replace(/\$CLAUDE_PROJECT_DIR/g, projectPath);
    }

    // Expand ~ to home directory
    if (expandedPath.startsWith('~')) {
      expandedPath = path.join(os.homedir(), expandedPath.slice(1));
    }

    // Handle relative paths (relative to project or home)
    if (!path.isAbsolute(expandedPath)) {
      const basePath = projectPath || os.homedir();
      expandedPath = path.join(basePath, expandedPath);
    }

    // Normalize the path
    expandedPath = path.normalize(expandedPath);

    if (!fs.existsSync(expandedPath)) {
      return `// File not found: ${expandedPath}`;
    }

    return fs.readFileSync(expandedPath, 'utf-8');
  } catch (error) {
    console.error('[HookManager] Error reading hook source:', error);
    return `// Error reading file: ${error}`;
  }
}

// ============================================================
// Hook Testing
// ============================================================

/**
 * Test a hook by running it with mock input
 * @param command - The hook command to run
 * @param input - Mock input to pipe to the hook (JSON object)
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @param projectPath - Optional project path for environment variable expansion
 * @returns Test result with output, error, and timing
 */
export async function testHook(
  command: string,
  input: Record<string, unknown>,
  timeout = 10000,
  projectPath?: string
): Promise<HookTestResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    try {
      // Expand environment variables in command
      let expandedCommand = command;
      if (projectPath) {
        expandedCommand = command.replace(/\$CLAUDE_PROJECT_DIR/g, projectPath);
      }
      expandedCommand = expandedCommand.replace(/\$HOME/g, os.homedir());

      // Determine working directory
      const cwd = projectPath || os.homedir();

      // Prepare the input JSON
      const inputJson = JSON.stringify(input);

      // Use echo to pipe input to the command
      const fullCommand = `echo '${inputJson.replace(/'/g, "'\\''")}' | ${expandedCommand}`;

      const child = spawn('bash', ['-c', fullCommand], {
        cwd,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectPath || '',
          HOME: os.homedir(),
        },
        timeout,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          output: stdout,
          error: 'Hook execution timed out',
          exitCode: -1,
          durationMs: Date.now() - startTime,
        });
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || undefined,
          exitCode: code ?? -1,
          durationMs,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output: '',
          error: err.message,
          exitCode: -1,
          durationMs: Date.now() - startTime,
        });
      });
    } catch (error) {
      resolve({
        success: false,
        output: '',
        error: String(error),
        exitCode: -1,
        durationMs: Date.now() - startTime,
      });
    }
  });
}

// ============================================================
// Hook Management (Enable/Disable)
// ============================================================

/**
 * Toggle a hook's enabled state
 * @param eventType - The hook event type (e.g., 'PreToolUse')
 * @param configIndex - Index of the HookConfig in the event type array
 * @param hookIndex - Index of the hook within the HookConfig
 * @param enabled - Whether to enable or disable the hook
 * @param scope - 'global' or 'project'
 * @param projectPath - Required when scope is 'project'
 * @returns Success status
 */
export function toggleHook(
  eventType: string,
  configIndex: number,
  hookIndex: number,
  enabled: boolean,
  scope: SettingsScope,
  projectPath?: string
): { success: boolean; error?: string } {
  try {
    const settings = readSettings(scope, projectPath);

    if (!settings.hooks) {
      return { success: false, error: 'No hooks defined in settings' };
    }

    const eventHooks = settings.hooks[eventType];
    if (!eventHooks || !Array.isArray(eventHooks)) {
      return { success: false, error: `No hooks for event type: ${eventType}` };
    }

    if (configIndex < 0 || configIndex >= eventHooks.length) {
      return { success: false, error: 'Invalid config index' };
    }

    const hookConfig = eventHooks[configIndex];
    if (!hookConfig.hooks || hookIndex < 0 || hookIndex >= hookConfig.hooks.length) {
      return { success: false, error: 'Invalid hook index' };
    }

    if (enabled) {
      // To enable, we just make sure the hook is in the config
      // (it already is if we're toggling it)
      // Nothing to do - the hook exists
    } else {
      // To disable, we need to remove the hook from the array
      // and store it somewhere if we want to re-enable later

      // For now, we'll add a "disabled" marker to the hook
      // Claude Code doesn't support this natively, so we actually remove it
      // and the UI should track what was removed

      hookConfig.hooks.splice(hookIndex, 1);

      // If no hooks left in this config, remove the config
      if (hookConfig.hooks.length === 0) {
        eventHooks.splice(configIndex, 1);
      }

      // If no configs left for this event type, remove the event type
      if (eventHooks.length === 0) {
        delete settings.hooks[eventType];
      }

      // If no hooks at all, remove the hooks key
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }
    }

    writeSettings(scope, settings, projectPath);
    return { success: true };
  } catch (error) {
    console.error('[HookManager] Error toggling hook:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Add a new hook to settings
 * @param eventType - The hook event type
 * @param command - The command to run
 * @param scope - 'global' or 'project'
 * @param options - Optional matcher and timeout
 * @param projectPath - Required when scope is 'project'
 */
export function addHook(
  eventType: string,
  command: string,
  scope: SettingsScope,
  options?: { matcher?: string[]; timeout?: number },
  projectPath?: string
): { success: boolean; error?: string } {
  try {
    const settings = readSettings(scope, projectPath);

    // Initialize hooks if not present
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Initialize event type array if not present
    if (!settings.hooks[eventType]) {
      settings.hooks[eventType] = [];
    }

    // Create new hook config
    const newHookConfig: HookConfig = {
      hooks: [
        {
          type: 'command',
          command,
          timeout: options?.timeout,
        },
      ],
    };

    if (options?.matcher && options.matcher.length > 0) {
      newHookConfig.matcher = options.matcher;
    }

    settings.hooks[eventType].push(newHookConfig);

    writeSettings(scope, settings, projectPath);
    return { success: true };
  } catch (error) {
    console.error('[HookManager] Error adding hook:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Remove a hook from settings
 */
export function removeHook(
  eventType: string,
  configIndex: number,
  hookIndex: number,
  scope: SettingsScope,
  projectPath?: string
): { success: boolean; error?: string } {
  return toggleHook(eventType, configIndex, hookIndex, false, scope, projectPath);
}

// ============================================================
// Test Input Examples
// ============================================================

/**
 * Get example test input for a hook event type
 */
export function getTestInputExample(eventType: string): Record<string, unknown> {
  const examples: Record<string, Record<string, unknown>> = {
    UserPromptSubmit: {
      prompt: 'test prompt',
    },
    PreToolUse: {
      tool_name: 'Bash',
      tool_input: {
        command: 'echo "hello"',
      },
    },
    PostToolUse: {
      tool_name: 'Edit',
      tool_input: {
        file_path: '/path/to/file.ts',
        old_string: 'old',
        new_string: 'new',
      },
      tool_output: 'File edited successfully',
    },
    SessionStart: {
      type: 'startup',
    },
    Stop: {
      transcript: 'User: Hello\nAssistant: Hi there!',
      stopReason: 'end_turn',
    },
    SubagentStop: {
      task: 'Implement feature X',
      result: 'Feature implemented successfully',
    },
  };

  return examples[eventType] || {};
}
