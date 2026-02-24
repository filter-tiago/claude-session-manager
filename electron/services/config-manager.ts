/**
 * Config Manager Service for Claude Session Manager
 *
 * Manages reading/writing Claude Code configuration files:
 * - Global settings: ~/.claude/settings.json
 * - Project settings: {projectPath}/.claude/settings.json
 * - MCP config: ~/.claude/mcp_config.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================
// Types
// ============================================================

export interface ClaudeSettings {
  permissions?: Record<string, string[]>;
  env?: Record<string, string>;
  apiKeyHelper?: string;
  hooks?: Record<string, HookConfig[]>;
  allow?: string[];
  deny?: string[];
  [key: string]: unknown;
}

export interface HookConfig {
  matcher?: string[];
  hooks: HookDefinition[];
}

export interface HookDefinition {
  type: 'command';
  command: string;
  timeout?: number;
}

export interface MCPServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface MCPConfig {
  mcpServers?: Record<string, MCPServer>;
  [key: string]: unknown;
}

export type SettingsScope = 'global' | 'project';

export interface ConfigWatcher {
  path: string;
  watcher: fs.FSWatcher;
  scope: SettingsScope;
  projectPath?: string;
}

// ============================================================
// Path Helpers
// ============================================================

/**
 * Get the path to global Claude settings
 * Returns: ~/.claude/settings.json
 */
export function getGlobalSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

/**
 * Get the path to project-specific Claude settings
 * Returns: {projectPath}/.claude/settings.json
 */
export function getProjectSettingsPath(projectPath: string): string {
  return path.join(projectPath, '.claude', 'settings.json');
}

/**
 * Get the path to MCP configuration file
 * Returns: ~/.claude/mcp_config.json (or claude_desktop_config.json as fallback)
 */
export function getMcpConfigPath(): string {
  const primaryPath = path.join(os.homedir(), '.claude', 'mcp_config.json');
  const fallbackPath = path.join(os.homedir(), '.claude', 'claude_desktop_config.json');

  // Check primary path first
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }

  // Check fallback path
  if (fs.existsSync(fallbackPath)) {
    return fallbackPath;
  }

  // Default to primary path (will be created if needed)
  return primaryPath;
}

// ============================================================
// Read Operations
// ============================================================

/**
 * Read Claude settings from the specified scope
 * @param scope - 'global' for ~/.claude/settings.json, 'project' for project-specific
 * @param projectPath - Required when scope is 'project'
 * @returns Settings object, or empty object if file doesn't exist
 */
export function readSettings(scope: SettingsScope, projectPath?: string): ClaudeSettings {
  const settingsPath = scope === 'global'
    ? getGlobalSettingsPath()
    : getProjectSettingsPath(projectPath!);

  return readJsonFile<ClaudeSettings>(settingsPath) ?? {};
}

/**
 * Read MCP configuration
 * @returns MCPConfig object, or empty object if file doesn't exist
 */
export function readMcpConfig(): MCPConfig {
  const configPath = getMcpConfigPath();
  return readJsonFile<MCPConfig>(configPath) ?? {};
}

/**
 * Generic JSON file reader with error handling
 */
function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.error(`[ConfigManager] Error reading ${filePath}:`, error);
    return null;
  }
}

// ============================================================
// Write Operations
// ============================================================

/**
 * Write Claude settings to the specified scope
 * @param scope - 'global' for ~/.claude/settings.json, 'project' for project-specific
 * @param settings - Settings object to write
 * @param projectPath - Required when scope is 'project'
 */
export function writeSettings(
  scope: SettingsScope,
  settings: ClaudeSettings,
  projectPath?: string
): void {
  const settingsPath = scope === 'global'
    ? getGlobalSettingsPath()
    : getProjectSettingsPath(projectPath!);

  // Validate path for project scope
  if (scope === 'project' && !projectPath) {
    throw new Error('projectPath is required for project scope');
  }

  writeJsonFile(settingsPath, settings);
}

/**
 * Write MCP configuration
 * @param config - MCPConfig object to write
 */
export function writeMcpConfig(config: MCPConfig): void {
  const configPath = getMcpConfigPath();
  writeJsonFile(configPath, config);
}

/**
 * Generic JSON file writer with error handling
 */
function writeJsonFile(filePath: string, data: unknown): void {
  try {
    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write with pretty formatting
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[ConfigManager] Wrote ${filePath}`);
  } catch (error) {
    console.error(`[ConfigManager] Error writing ${filePath}:`, error);
    throw error;
  }
}

// ============================================================
// File Watching
// ============================================================

const activeWatchers: Map<string, ConfigWatcher> = new Map();

export type SettingsChangeCallback = (data: {
  scope: SettingsScope;
  projectPath?: string;
  settings: ClaudeSettings | MCPConfig;
  type: 'settings' | 'mcp';
}) => void;

/**
 * Watch settings file for changes
 * @param scope - 'global' or 'project'
 * @param callback - Called when file changes
 * @param projectPath - Required when scope is 'project'
 * @returns Cleanup function to stop watching
 */
export function watchSettings(
  scope: SettingsScope,
  callback: SettingsChangeCallback,
  projectPath?: string
): () => void {
  const settingsPath = scope === 'global'
    ? getGlobalSettingsPath()
    : getProjectSettingsPath(projectPath!);

  return watchFile(settingsPath, () => {
    const settings = readSettings(scope, projectPath);
    callback({
      scope,
      projectPath,
      settings,
      type: 'settings',
    });
  }, scope, projectPath);
}

/**
 * Watch MCP config file for changes
 * @param callback - Called when file changes
 * @returns Cleanup function to stop watching
 */
export function watchMcpConfig(callback: SettingsChangeCallback): () => void {
  const configPath = getMcpConfigPath();

  return watchFile(configPath, () => {
    const config = readMcpConfig();
    callback({
      scope: 'global',
      settings: config,
      type: 'mcp',
    });
  }, 'global');
}

/**
 * Internal file watcher with debouncing
 */
function watchFile(
  filePath: string,
  callback: () => void,
  scope: SettingsScope,
  projectPath?: string
): () => void {
  // Stop existing watcher for this path
  const existingWatcher = activeWatchers.get(filePath);
  if (existingWatcher) {
    existingWatcher.watcher.close();
    activeWatchers.delete(filePath);
  }

  // Ensure directory exists before watching
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Debounce to avoid rapid-fire events
  let debounceTimer: NodeJS.Timeout | null = null;

  try {
    // Watch the directory (more reliable than watching file directly)
    const watcher = fs.watch(dirPath, (_eventType, filename) => {
      if (filename === path.basename(filePath)) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          callback();
        }, 100);
      }
    });

    const configWatcher: ConfigWatcher = {
      path: filePath,
      watcher,
      scope,
      projectPath,
    };

    activeWatchers.set(filePath, configWatcher);

    // Return cleanup function
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      watcher.close();
      activeWatchers.delete(filePath);
    };
  } catch (error) {
    console.error(`[ConfigManager] Error watching ${filePath}:`, error);
    // Return no-op cleanup if watch fails
    return () => {};
  }
}

/**
 * Stop all active watchers
 */
export function stopAllWatchers(): void {
  for (const [, watcher] of activeWatchers) {
    watcher.watcher.close();
  }
  activeWatchers.clear();
  console.log('[ConfigManager] Stopped all file watchers');
}

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validate that a path is within allowed directories
 * Prevents directory traversal attacks
 */
export function isValidProjectPath(projectPath: string): boolean {
  // Normalize the path to resolve any .. or .
  const normalizedPath = path.normalize(projectPath);
  const resolvedPath = path.resolve(normalizedPath);

  // Check that it doesn't try to escape (e.g., no .. above home)
  const homeDir = os.homedir();

  // Allow paths within home directory or commonly used development directories
  const allowedPrefixes = [
    homeDir,
    '/tmp',
    '/var/tmp',
  ];

  return allowedPrefixes.some(prefix => resolvedPath.startsWith(prefix));
}

/**
 * Validate settings object structure
 */
export function validateSettings(settings: unknown): settings is ClaudeSettings {
  if (typeof settings !== 'object' || settings === null) {
    return false;
  }

  // Basic structure validation
  const obj = settings as Record<string, unknown>;

  // Optional fields with type checks
  if (obj.permissions !== undefined && typeof obj.permissions !== 'object') {
    return false;
  }

  if (obj.env !== undefined && typeof obj.env !== 'object') {
    return false;
  }

  if (obj.hooks !== undefined && typeof obj.hooks !== 'object') {
    return false;
  }

  if (obj.allow !== undefined && !Array.isArray(obj.allow)) {
    return false;
  }

  if (obj.deny !== undefined && !Array.isArray(obj.deny)) {
    return false;
  }

  return true;
}

/**
 * Validate MCP config structure
 */
export function validateMcpConfig(config: unknown): config is MCPConfig {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const obj = config as Record<string, unknown>;

  if (obj.mcpServers !== undefined) {
    if (typeof obj.mcpServers !== 'object' || obj.mcpServers === null) {
      return false;
    }

    // Validate each server entry
    for (const [, server] of Object.entries(obj.mcpServers)) {
      if (typeof server !== 'object' || server === null) {
        return false;
      }
      const serverObj = server as Record<string, unknown>;
      if (typeof serverObj.command !== 'string') {
        return false;
      }
    }
  }

  return true;
}
