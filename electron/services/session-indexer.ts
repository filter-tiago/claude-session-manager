/**
 * Session Indexer for Claude Session Manager
 *
 * Watches ~/.claude/projects/ for JSONL files and indexes them into SQLite.
 * Features:
 * - File watching with chokidar
 * - Streaming JSONL parsing for large files
 * - Incremental indexing (only reindex when file changes)
 * - Activity detection from message content
 * - File extraction from tool calls
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as os from 'os';
import chokidar from 'chokidar';
import {
  upsertSession,
  insertEvents,
  deleteSessionEvents,
  indexForSearch,
  getSession,
} from './database';
import type { Session, SessionEvent } from '../../src/types/electron';

// Claude projects base directory
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// Watcher instance
let watcher: ReturnType<typeof chokidar.watch> | null = null;

// Event emitter for session updates (will be connected to IPC)
type SessionUpdateCallback = (session: Session) => void;
let onSessionUpdateCallback: SessionUpdateCallback | null = null;

// ============================================================
// JSONL Event Types
// ============================================================

interface JsonlEvent {
  type: string;
  timestamp: string;
  sessionId: string;
  uuid?: string;
  parentUuid?: string;

  // Session metadata
  cwd?: string;
  gitBranch?: string;
  permissionMode?: string;
  version?: string;

  // User message
  message?: {
    role: 'user' | 'assistant';
    content: string | JsonlContentBlock[];
    model?: string;
    stop_reason?: string | null;
  };

  // Progress/tool events
  data?: {
    type: string;
    hookEvent?: string;
    hookName?: string;
    command?: string;
  };
}

interface JsonlContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | JsonlContentBlock[];
  tool_use_id?: string;
}

// ============================================================
// Indexer Core
// ============================================================

/**
 * Parse a JSONL file and extract session data
 */
export async function parseSessionFile(filePath: string): Promise<{
  session: Omit<Session, 'indexed_at'>;
  events: Omit<SessionEvent, 'id'>[];
  searchContent: string;
  toolNames: Set<string>;
  filesTouched: Set<string>;
}> {
  const sessionId = path.basename(filePath, '.jsonl');
  const projectDir = path.basename(path.dirname(filePath));
  const projectPath = decodeProjectPath(projectDir);
  const projectName = path.basename(projectPath);

  // Initialize session data
  let session: Omit<Session, 'indexed_at'> = {
    session_id: sessionId,
    slug: sessionId.substring(0, 8),
    project_path: projectPath,
    project_name: projectName,
    status: 'active',
    started_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    message_count: 0,
    tool_call_count: 0,
    file_path: filePath,
    file_size_bytes: 0,
  };

  const events: Omit<SessionEvent, 'id'>[] = [];
  const toolNames = new Set<string>();
  const filesTouched = new Set<string>();
  const searchContentParts: string[] = [];

  let firstUserMessage: string | null = null;
  let lastTimestamp: string | null = null;
  let messageCount = 0;
  let toolCallCount = 0;

  // Get file stats
  try {
    const stats = fs.statSync(filePath);
    session.file_size_bytes = stats.size;
  } catch {
    // File might have been deleted
  }

  // Stream parse the JSONL file
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const event = JSON.parse(line) as JsonlEvent;

      // Track timestamps
      if (event.timestamp) {
        if (!session.started_at || event.timestamp < session.started_at) {
          session.started_at = event.timestamp;
        }
        lastTimestamp = event.timestamp;
      }

      // Extract metadata from first event with cwd
      if (event.cwd && !session.working_directory) {
        session.working_directory = event.cwd;
      }
      if (event.gitBranch && !session.git_branch) {
        session.git_branch = event.gitBranch;
      }
      if (event.permissionMode && !session.permission_mode) {
        session.permission_mode = event.permissionMode;
      }

      // Process based on event type
      if (event.type === 'user') {
        messageCount++;
        const content = extractTextContent(event.message?.content);

        if (content) {
          // Capture first user message for task detection
          if (!firstUserMessage) {
            firstUserMessage = content.substring(0, 500);
          }
          searchContentParts.push(content);

          events.push({
            session_id: sessionId,
            timestamp: event.timestamp,
            event_type: 'user',
            content: content.substring(0, 10000), // Limit content size
            tool_name: undefined,
            tool_input: undefined,
            tool_output: undefined,
            files_touched: undefined,
          });
        }

        // Check for tool results
        if (Array.isArray(event.message?.content)) {
          for (const block of event.message.content as JsonlContentBlock[]) {
            if (block.type === 'tool_result') {
              const toolContent = extractTextContent(block.content);
              if (toolContent) {
                // Extract file paths from tool output
                extractFilePaths(toolContent, filesTouched);
              }
            }
          }
        }
      } else if (event.type === 'assistant') {
        const content = event.message?.content;

        if (Array.isArray(content)) {
          for (const block of content as JsonlContentBlock[]) {
            if (block.type === 'text' && block.text) {
              searchContentParts.push(block.text);

              events.push({
                session_id: sessionId,
                timestamp: event.timestamp,
                event_type: 'assistant_text',
                content: block.text.substring(0, 10000),
                tool_name: undefined,
                tool_input: undefined,
                tool_output: undefined,
                files_touched: undefined,
              });
            } else if (block.type === 'tool_use') {
              toolCallCount++;
              const toolName = block.name || 'unknown';
              toolNames.add(toolName);

              // Extract files from tool input
              if (block.input) {
                extractFilesFromToolInput(toolName, block.input, filesTouched);
              }

              events.push({
                session_id: sessionId,
                timestamp: event.timestamp,
                event_type: 'tool_use',
                content: undefined,
                tool_name: toolName,
                tool_input: JSON.stringify(block.input)?.substring(0, 5000),
                tool_output: undefined,
                files_touched: Array.from(filesTouched).slice(-10).join(','),
              });
            }
          }
        } else if (typeof content === 'string') {
          searchContentParts.push(content);
        }
      }
    } catch (e) {
      // Skip malformed lines
      console.warn(`[Indexer] Skipping malformed line in ${filePath}:`, e);
    }
  }

  // Update session with aggregated data
  session.message_count = messageCount;
  session.tool_call_count = toolCallCount;
  session.last_activity = lastTimestamp || session.started_at;

  // Detect task from first user message
  if (firstUserMessage) {
    session.detected_task = detectTask(firstUserMessage);
  }

  // Detect activity type from tool usage
  session.detected_activity = detectActivity(toolNames);

  // Detect area from file paths
  session.detected_area = detectArea(filesTouched);

  // Determine status based on activity
  session.status = determineStatus(session.last_activity);

  // Combine search content
  const searchContent = searchContentParts.join('\n').substring(0, 100000);

  return {
    session,
    events,
    searchContent,
    toolNames,
    filesTouched,
  };
}

/**
 * Index a single session file
 */
// Counter for logging progress
let indexedCount = 0;

export async function indexSessionFile(filePath: string): Promise<Session | null> {
  try {
    // Only log every 100 files to reduce output
    indexedCount++;
    if (indexedCount % 100 === 0) {
      console.log(`[Indexer] Indexed ${indexedCount} files...`);
    }

    const { session, events, searchContent, toolNames, filesTouched } = await parseSessionFile(filePath);

    // Check if we need to reindex (file changed since last index)
    const existing = getSession(session.session_id);
    if (existing && existing.file_size_bytes === session.file_size_bytes) {
      // File hasn't changed, skip reindex but update status
      const newStatus = determineStatus(existing.last_activity);
      if (newStatus !== existing.status) {
        upsertSession({ ...existing, status: newStatus });
      }
      return existing;
    }

    // Delete old events before reindexing
    deleteSessionEvents(session.session_id);

    // Insert session
    upsertSession(session);

    // Insert events in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      insertEvents(batch);
    }

    // Index for search
    indexForSearch(
      session.session_id,
      searchContent,
      Array.from(toolNames),
      Array.from(filesTouched)
    );

    // Get the full session with indexed_at
    const indexed = getSession(session.session_id);

    // Notify listeners
    if (indexed && onSessionUpdateCallback) {
      onSessionUpdateCallback(indexed);
    }

    console.log(`[Indexer] Indexed: ${session.slug} (${session.message_count} messages, ${session.tool_call_count} tool calls)`);

    return indexed;
  } catch (e) {
    console.error(`[Indexer] Failed to index ${filePath}:`, e);
    return null;
  }
}

/**
 * Index all sessions in the Claude projects directory
 */
export async function indexAllSessions(): Promise<number> {
  console.log('[Indexer] Starting full index...');
  indexedCount = 0; // Reset counter

  let count = 0;

  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    console.log('[Indexer] Claude projects directory not found:', CLAUDE_PROJECTS_DIR);
    return count;
  }

  const projectDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR);

  for (const projectDir of projectDirs) {
    const projectPath = path.join(CLAUDE_PROJECTS_DIR, projectDir);
    const stat = fs.statSync(projectPath);

    if (!stat.isDirectory()) continue;

    const files = fs.readdirSync(projectPath);

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const filePath = path.join(projectPath, file);
      const session = await indexSessionFile(filePath);

      if (session) {
        count++;
      }
    }
  }

  console.log(`[Indexer] Full index complete: ${count} sessions indexed`);
  return count;
}

// ============================================================
// File Watcher
// ============================================================

/**
 * Start watching for new/modified session files
 */
export function startWatcher(onUpdate?: SessionUpdateCallback): void {
  if (watcher) {
    console.log('[Indexer] Watcher already running');
    return;
  }

  onSessionUpdateCallback = onUpdate || null;

  const watchPattern = path.join(CLAUDE_PROJECTS_DIR, '*', '*.jsonl');
  console.log('[Indexer] Starting watcher:', watchPattern);

  watcher = chokidar.watch(watchPattern, {
    persistent: true,
    ignoreInitial: true, // Don't index on startup (do full index separately)
    awaitWriteFinish: {
      stabilityThreshold: 2000, // Wait 2 seconds for file to stop changing
      pollInterval: 500,
    },
  });

  watcher.on('add', (filePath: string) => {
    console.log('[Indexer] New file:', filePath);
    indexSessionFile(filePath);
  });

  watcher.on('change', (filePath: string) => {
    console.log('[Indexer] File changed:', filePath);
    indexSessionFile(filePath);
  });

  watcher.on('error', (error: unknown) => {
    console.error('[Indexer] Watcher error:', error);
  });

  console.log('[Indexer] Watcher started');
}

/**
 * Stop the file watcher
 */
export function stopWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    onSessionUpdateCallback = null;
    console.log('[Indexer] Watcher stopped');
  }
}

/**
 * Set the callback for session updates
 */
export function setSessionUpdateCallback(callback: SessionUpdateCallback | null): void {
  onSessionUpdateCallback = callback;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Decode project directory name to path
 * e.g., "-Users-partiu-workspace-project" -> "/Users/partiu/workspace/project"
 */
function decodeProjectPath(dirName: string): string {
  // Replace leading dash with slash, then all dashes with slashes
  return dirName.replace(/^-/, '/').replace(/-/g, '/');
}

/**
 * Extract text content from message content (handles arrays and strings)
 */
function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (block.type === 'text' && block.text) {
        parts.push(block.text);
      }
    }
    return parts.join('\n');
  }

  return '';
}

/**
 * Extract file paths from text content
 */
function extractFilePaths(text: string, filesTouched: Set<string>): void {
  // Match common file path patterns
  const pathPatterns = [
    // Absolute paths
    /\/(?:Users|home|var|tmp|etc)\/[^\s\n\r'"<>|]+/g,
    // Relative paths with extensions
    /(?:\.\/|\.\.\/)?[\w\-./]+\.\w{1,10}/g,
  ];

  for (const pattern of pathPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Clean up and add
        const cleaned = match.replace(/[,;:'")\]}>]+$/, '');
        if (cleaned.length > 2 && cleaned.length < 500) {
          filesTouched.add(cleaned);
        }
      }
    }
  }
}

/**
 * Extract files from tool input based on tool name
 */
function extractFilesFromToolInput(
  toolName: string,
  input: Record<string, unknown>,
  filesTouched: Set<string>
): void {
  const fileFields = ['file_path', 'path', 'filename', 'source', 'target', 'destination'];

  for (const field of fileFields) {
    if (typeof input[field] === 'string') {
      filesTouched.add(input[field] as string);
    }
  }

  // Handle specific tools
  if (toolName === 'Bash' || toolName === 'bash') {
    const command = input.command as string;
    if (command) {
      extractFilePaths(command, filesTouched);
    }
  }

  if (toolName === 'Read' || toolName === 'read_file') {
    if (typeof input.file_path === 'string') {
      filesTouched.add(input.file_path);
    }
  }

  if (toolName === 'Write' || toolName === 'write_file') {
    if (typeof input.file_path === 'string') {
      filesTouched.add(input.file_path);
    }
  }

  if (toolName === 'Edit' || toolName === 'edit_file') {
    if (typeof input.file_path === 'string') {
      filesTouched.add(input.file_path);
    }
  }

  if (toolName === 'Glob' || toolName === 'glob') {
    if (typeof input.pattern === 'string') {
      filesTouched.add(input.pattern);
    }
  }

  if (toolName === 'Grep' || toolName === 'grep') {
    if (typeof input.path === 'string') {
      filesTouched.add(input.path);
    }
  }
}

/**
 * Detect task from first user message
 */
function detectTask(message: string): string {
  // Clean up the message
  let task = message
    .replace(/^#+\s*/gm, '') // Remove markdown headers
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\n+/g, ' ') // Normalize newlines
    .trim();

  // Take first sentence or first 200 chars
  const firstSentence = task.match(/^[^.!?]+[.!?]/);
  if (firstSentence) {
    task = firstSentence[0];
  }

  return task.substring(0, 200);
}

/**
 * Detect activity type from tool usage
 */
function detectActivity(toolNames: Set<string>): string {
  const hasEdit = toolNames.has('Edit') || toolNames.has('Write');
  const hasRead = toolNames.has('Read') || toolNames.has('Grep') || toolNames.has('Glob');
  const hasBash = toolNames.has('Bash');
  const hasGit = Array.from(toolNames).some((t) => t.toLowerCase().includes('git'));

  if (hasGit && hasEdit) return 'committing';
  if (hasEdit && hasBash) return 'implementing';
  if (hasEdit && !hasBash) return 'editing';
  if (hasRead && !hasEdit) return 'exploring';
  if (hasBash && !hasRead) return 'running';

  return 'chatting';
}

/**
 * Detect area from file paths
 */
function detectArea(filesTouched: Set<string>): string | undefined {
  const pathCounts: Record<string, number> = {};

  for (const filePath of filesTouched) {
    // Extract area from path like /Users/.../areas/engineering/...
    const areaMatch = filePath.match(/areas\/([^/]+)/);
    if (areaMatch) {
      const area = areaMatch[1];
      pathCounts[area] = (pathCounts[area] || 0) + 1;
    }

    // Also check for common project patterns
    const projectMatch = filePath.match(/workspace\/[^/]+\/([^/]+)/);
    if (projectMatch) {
      const project = projectMatch[1];
      pathCounts[project] = (pathCounts[project] || 0) + 1;
    }
  }

  // Return most common area
  let maxCount = 0;
  let maxArea: string | undefined;

  for (const [area, count] of Object.entries(pathCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxArea = area;
    }
  }

  return maxArea;
}

/**
 * Determine session status based on last activity
 */
function determineStatus(lastActivity: string): 'active' | 'idle' | 'completed' {
  const lastActivityDate = new Date(lastActivity);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60);

  if (diffMinutes < 5) return 'active';
  if (diffMinutes < 60) return 'idle';
  return 'completed';
}

// ============================================================
// Exports for testing
// ============================================================

export { decodeProjectPath, extractTextContent, detectTask, detectActivity, determineStatus };
