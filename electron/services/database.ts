/**
 * SQLite Database Service for Claude Session Manager
 *
 * Provides a wrapper around better-sqlite3 with:
 * - FTS5 full-text search support
 * - Session and event storage
 * - Search indexing
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import type { Session, SessionEvent, SessionStats } from '../../src/types/electron';

// Type alias for the database instance
type DatabaseInstance = DatabaseType;

// Database file location in app data directory
const getDbPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'sessions.db');
};

let db: DatabaseInstance | null = null;

/**
 * Initialize the database with schema
 */
export function initDatabase(): DatabaseInstance {
  if (db) return db;

  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create schema
  db.exec(`
    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      project_path TEXT NOT NULL,
      project_name TEXT,
      working_directory TEXT,
      git_branch TEXT,
      permission_mode TEXT,
      started_at TEXT NOT NULL,
      last_activity TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      message_count INTEGER DEFAULT 0,
      tool_call_count INTEGER DEFAULT 0,
      detected_task TEXT,
      detected_activity TEXT,
      detected_area TEXT,
      name TEXT,
      tags TEXT,
      ledger_link TEXT,
      tmux_session TEXT,
      tmux_pane TEXT,
      tmux_pane_pid INTEGER,
      tmux_alive INTEGER DEFAULT NULL,
      file_path TEXT NOT NULL,
      file_size_bytes INTEGER,
      indexed_at TEXT NOT NULL
    );

    -- FTS5 virtual table for full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS session_search USING fts5(
      session_id,
      content,
      tool_name,
      files_touched
    );

    -- Events table
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      content TEXT,
      tool_name TEXT,
      tool_input TEXT,
      tool_output TEXT,
      files_touched TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    );

    -- Indexes for efficient queries
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

    -- Workspaces table
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      project_path TEXT NOT NULL,
      tmux_session TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
    CREATE INDEX IF NOT EXISTS idx_workspaces_project ON workspaces(project_path);
  `);

  // Migrations for existing databases
  runMigrations(db);

  console.log('[Database] Initialized at:', dbPath);
  return db;
}

/**
 * Run database migrations for schema updates
 */
function runMigrations(db: DatabaseInstance): void {
  // Check if tmux_alive column exists
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const hasTmuxAlive = tableInfo.some(col => col.name === 'tmux_alive');

  if (!hasTmuxAlive) {
    console.log('[Database] Running migration: adding tmux_alive column');
    db.exec('ALTER TABLE sessions ADD COLUMN tmux_alive INTEGER DEFAULT NULL');
  }
}

/**
 * Get the database instance (initializes if needed)
 */
export function getDb(): DatabaseInstance {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[Database] Closed');
  }
}

// ============================================================
// Session Operations
// ============================================================

/**
 * Insert or update a session
 */
export function upsertSession(session: Omit<Session, 'indexed_at'>): void {
  const db = getDb();
  const indexedAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO sessions (
      session_id, slug, project_path, project_name, working_directory,
      git_branch, permission_mode, started_at, last_activity, status,
      message_count, tool_call_count, detected_task, detected_activity,
      detected_area, name, tags, ledger_link, tmux_session, tmux_pane,
      tmux_pane_pid, file_path, file_size_bytes, indexed_at
    ) VALUES (
      @session_id, @slug, @project_path, @project_name, @working_directory,
      @git_branch, @permission_mode, @started_at, @last_activity, @status,
      @message_count, @tool_call_count, @detected_task, @detected_activity,
      @detected_area, @name, @tags, @ledger_link, @tmux_session, @tmux_pane,
      @tmux_pane_pid, @file_path, @file_size_bytes, @indexed_at
    )
    ON CONFLICT(session_id) DO UPDATE SET
      last_activity = @last_activity,
      status = @status,
      message_count = @message_count,
      tool_call_count = @tool_call_count,
      detected_task = COALESCE(@detected_task, detected_task),
      detected_activity = @detected_activity,
      detected_area = COALESCE(@detected_area, detected_area),
      name = COALESCE(@name, name),
      tags = COALESCE(@tags, tags),
      tmux_session = @tmux_session,
      tmux_pane = @tmux_pane,
      tmux_pane_pid = @tmux_pane_pid,
      file_size_bytes = @file_size_bytes,
      indexed_at = @indexed_at
  `);

  // Ensure all fields have at least null values for the prepared statement
  const sessionData = {
    session_id: session.session_id,
    slug: session.slug,
    project_path: session.project_path,
    project_name: session.project_name ?? null,
    working_directory: session.working_directory ?? null,
    git_branch: session.git_branch ?? null,
    permission_mode: session.permission_mode ?? null,
    started_at: session.started_at,
    last_activity: session.last_activity,
    status: session.status,
    message_count: session.message_count,
    tool_call_count: session.tool_call_count,
    detected_task: session.detected_task ?? null,
    detected_activity: session.detected_activity ?? null,
    detected_area: session.detected_area ?? null,
    name: session.name ?? null,
    tags: session.tags ?? null,
    ledger_link: session.ledger_link ?? null,
    tmux_session: session.tmux_session ?? null,
    tmux_pane: session.tmux_pane ?? null,
    tmux_pane_pid: session.tmux_pane_pid ?? null,
    file_path: session.file_path,
    file_size_bytes: session.file_size_bytes ?? null,
    indexed_at: indexedAt,
  };

  stmt.run(sessionData);
}

/**
 * Options for filtering sessions in getSessions()
 */
export interface GetSessionsOptions {
  limit?: number;           // Default: 0 (no limit)
  offset?: number;          // Default: 0 (only used when limit > 0)
  maxAgeDays?: number;      // Default: 1
  includeActive?: boolean;  // Default: true - always include active regardless of age
  status?: string;          // Optional explicit status filter
  projectPath?: string;     // Optional project filter
  showAll?: boolean;        // If true, bypasses smart filtering
}

/**
 * Get sessions with smart default filtering
 *
 * Default behavior (smart filtering):
 * - All active sessions (regardless of age)
 * - All sessions from last 24 hours (regardless of status)
 * - No count limit, only time-based filtering
 *
 * Use showAll: true to get all sessions (for search, pagination, etc.)
 */
export function getSessions(options: GetSessionsOptions = {}): Session[] {
  const db = getDb();

  const {
    limit = 0, // 0 = no limit
    offset = 0,
    maxAgeDays = 1,
    // includeActive is always true in smart filtering mode - active sessions are always shown
    status,
    projectPath,
    showAll = false,
  } = options;

  const safeLimit = Math.max(0, limit);
  const safeOffset = Math.max(0, offset);

  // If explicit status filter, apply with optional limit
  if (status) {
    const projectSql = projectPath ? ' AND project_path = ?' : '';
    const projectParams = projectPath ? [projectPath] : [];
    if (safeLimit > 0) {
      const stmt = db.prepare(`
        SELECT * FROM sessions
        WHERE status = ?${projectSql}
        ORDER BY last_activity DESC
        LIMIT ? OFFSET ?
      `);
      return stmt.all(status, ...projectParams, safeLimit, safeOffset) as Session[];
    }
    const stmt = db.prepare(`
      SELECT * FROM sessions
      WHERE status = ?${projectSql}
      ORDER BY last_activity DESC
    `);
    return stmt.all(status, ...projectParams) as Session[];
  }

  // If showAll, return all sessions with optional limit
  if (showAll) {
    const whereSql = projectPath ? 'WHERE project_path = ?' : '';
    const whereParams = projectPath ? [projectPath] : [];
    if (safeLimit > 0) {
      const stmt = db.prepare(`
        SELECT * FROM sessions
        ${whereSql}
        ORDER BY last_activity DESC
        LIMIT ? OFFSET ?
      `);
      return stmt.all(...whereParams, safeLimit, safeOffset) as Session[];
    }
    const stmt = db.prepare(`
      SELECT * FROM sessions
      ${whereSql}
      ORDER BY last_activity DESC
    `);
    return stmt.all(...whereParams) as Session[];
  }

  // Smart filtering: active sessions + recent sessions (time-based only)
  const projectSql = projectPath ? ' AND project_path = ?' : '';
  const projectParams = projectPath ? [projectPath] : [];
  if (safeLimit > 0) {
    const stmt = db.prepare(`
      SELECT * FROM sessions
      WHERE (
        status = 'active'
        OR last_activity > datetime('now', '-' || ? || ' days')
      )${projectSql}
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        last_activity DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(maxAgeDays, ...projectParams, safeLimit, safeOffset) as Session[];
  }

  const stmt = db.prepare(`
    SELECT * FROM sessions
    WHERE (
      status = 'active'
      OR last_activity > datetime('now', '-' || ? || ' days')
    )${projectSql}
    ORDER BY
      CASE WHEN status = 'active' THEN 0 ELSE 1 END,
      last_activity DESC
  `);
  return stmt.all(maxAgeDays, ...projectParams) as Session[];
}

/**
 * Get total count of all sessions (for UI display)
 */
export function getTotalSessionCount(): number {
  const db = getDb();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM sessions');
  const result = stmt.get() as { count: number };
  return result.count;
}

/**
 * Get a single session by ID
 */
export function getSession(sessionId: string): Session | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM sessions WHERE session_id = ?');
  const result = stmt.get(sessionId) as Session | undefined;
  return result || null;
}

/**
 * Get distinct projects from sessions table
 */
export function getDistinctProjects(): Array<{ project_path: string; project_name: string }> {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT DISTINCT project_path, project_name
    FROM sessions
    WHERE project_path IS NOT NULL AND project_path != ''
    ORDER BY project_name ASC
  `);
  return stmt.all() as Array<{ project_path: string; project_name: string }>;
}

/**
 * Get sessions by project path
 */
export function getSessionsByProject(projectPath: string): Session[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM sessions WHERE project_path = ? ORDER BY last_activity DESC');
  return stmt.all(projectPath) as Session[];
}

/**
 * Update session status
 */
export function updateSessionStatus(sessionId: string, status: 'active' | 'idle' | 'completed'): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE sessions SET status = ? WHERE session_id = ?');
  stmt.run(status, sessionId);
}

/**
 * Update session tmux mapping
 */
export function updateSessionTmux(
  sessionId: string,
  tmuxSession: string | null,
  tmuxPane: string | null,
  tmuxPanePid: number | null
): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE sessions
    SET tmux_session = ?, tmux_pane = ?, tmux_pane_pid = ?
    WHERE session_id = ?
  `);
  stmt.run(tmuxSession, tmuxPane, tmuxPanePid, sessionId);
}

/**
 * Update session tmux liveness status and adjust session status accordingly
 * @param sessionId - The session ID
 * @param alive - true if Claude is running in tmux, false if not, null to clear
 *
 * Status logic:
 * - If tmux_alive=true → status stays/becomes "active" regardless of time
 * - If tmux_alive=false and last_activity > 60min → status becomes "completed"
 * - If tmux_alive=null → no status change (time-based logic applies via indexer)
 */
export function updateSessionTmuxAlive(
  sessionId: string,
  alive: boolean | null
): void {
  const db = getDb();

  if (alive === true) {
    // Claude is running - always mark as active
    const stmt = db.prepare(`
      UPDATE sessions
      SET tmux_alive = 1, status = 'active'
      WHERE session_id = ?
    `);
    stmt.run(sessionId);
  } else if (alive === false) {
    // Claude not running - check time and update accordingly
    const session = getSession(sessionId);
    if (session) {
      const lastActivityDate = new Date(session.last_activity);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60);

      // If >60 min without activity and no Claude running, mark completed
      const newStatus = diffMinutes > 60 ? 'completed' : (diffMinutes > 5 ? 'idle' : session.status);

      const stmt = db.prepare(`
        UPDATE sessions
        SET tmux_alive = 0, status = ?
        WHERE session_id = ?
      `);
      stmt.run(newStatus, sessionId);
    } else {
      // Session doesn't exist, just update the flag
      const stmt = db.prepare(`
        UPDATE sessions
        SET tmux_alive = 0
        WHERE session_id = ?
      `);
      stmt.run(sessionId);
    }
  } else {
    // null - clear the flag without changing status
    const stmt = db.prepare(`
      UPDATE sessions
      SET tmux_alive = NULL
      WHERE session_id = ?
    `);
    stmt.run(sessionId);
  }
}

/**
 * Update session user annotations
 */
export function updateSessionAnnotations(
  sessionId: string,
  name?: string,
  tags?: string,
  ledgerLink?: string
): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE sessions
    SET name = COALESCE(?, name),
        tags = COALESCE(?, tags),
        ledger_link = COALESCE(?, ledger_link)
    WHERE session_id = ?
  `);
  stmt.run(name, tags, ledgerLink, sessionId);
}

/**
 * Update session auto-detected fields
 */
export function updateSessionDetectedFields(
  sessionId: string,
  detectedArea?: string,
  detectedTask?: string,
  detectedActivity?: string
): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE sessions
    SET detected_area = COALESCE(?, detected_area),
        detected_task = COALESCE(?, detected_task),
        detected_activity = COALESCE(?, detected_activity)
    WHERE session_id = ?
  `);
  stmt.run(detectedArea, detectedTask, detectedActivity, sessionId);
}

/**
 * Delete a session and its events
 */
export function deleteSession(sessionId: string): void {
  const db = getDb();
  const deleteSearch = db.prepare('DELETE FROM session_search WHERE session_id = ?');
  const deleteSession = db.prepare('DELETE FROM sessions WHERE session_id = ?');

  const transaction = db.transaction(() => {
    deleteSearch.run(sessionId);
    deleteSession.run(sessionId);
  });

  transaction();
}

// ============================================================
// Workspace Operations
// ============================================================

export interface Workspace {
  id: number;
  name: string;
  project_path: string;
  tmux_session: string | null;
  description: string | null;
  created_at: string;
  completed_at: string | null;
  status: 'active' | 'completed';
}

/**
 * Insert a new workspace
 */
export function insertWorkspace(workspace: Omit<Workspace, 'id'>): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO workspaces (
      name, project_path, tmux_session, description, created_at, completed_at, status
    ) VALUES (
      @name, @project_path, @tmux_session, @description, @created_at, @completed_at, @status
    )
  `);

  const result = stmt.run({
    name: workspace.name,
    project_path: workspace.project_path,
    tmux_session: workspace.tmux_session ?? null,
    description: workspace.description ?? null,
    created_at: workspace.created_at,
    completed_at: workspace.completed_at ?? null,
    status: workspace.status,
  });

  return Number(result.lastInsertRowid);
}

/**
 * Get workspaces with optional status filter
 */
export function getWorkspaces(options?: { status?: 'active' | 'completed' }): Workspace[] {
  const db = getDb();

  if (options?.status) {
    const stmt = db.prepare('SELECT * FROM workspaces WHERE status = ? ORDER BY created_at DESC');
    return stmt.all(options.status) as Workspace[];
  }

  const stmt = db.prepare('SELECT * FROM workspaces ORDER BY created_at DESC');
  return stmt.all() as Workspace[];
}

/**
 * Get a single workspace by ID
 */
export function getWorkspace(id: number): Workspace | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM workspaces WHERE id = ?');
  const result = stmt.get(id) as Workspace | undefined;
  return result || null;
}

/**
 * Get a workspace by name
 */
export function getWorkspaceByName(name: string): Workspace | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM workspaces WHERE name = ?');
  const result = stmt.get(name) as Workspace | undefined;
  return result || null;
}

/**
 * Update a workspace
 */
export function updateWorkspace(
  id: number,
  updates: Partial<Omit<Workspace, 'id'>>
): void {
  const db = getDb();

  // Build dynamic UPDATE statement
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.project_path !== undefined) {
    fields.push('project_path = ?');
    values.push(updates.project_path);
  }
  if (updates.tmux_session !== undefined) {
    fields.push('tmux_session = ?');
    values.push(updates.tmux_session);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.completed_at !== undefined) {
    fields.push('completed_at = ?');
    values.push(updates.completed_at);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }

  if (fields.length === 0) return;

  values.push(id);
  const stmt = db.prepare(`UPDATE workspaces SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

/**
 * Delete a workspace
 */
export function deleteWorkspace(id: number): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM workspaces WHERE id = ?');
  stmt.run(id);
}

/**
 * Get sessions that belong to a workspace (by project path and time range)
 */
export function getWorkspaceSessions(workspaceId: number): Session[] {
  const db = getDb();
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return [];

  const stmt = db.prepare(`
    SELECT * FROM sessions
    WHERE project_path = ?
      AND started_at >= ?
      AND (? IS NULL OR started_at <= ?)
    ORDER BY started_at DESC
  `);

  return stmt.all(
    workspace.project_path,
    workspace.created_at,
    workspace.completed_at,
    workspace.completed_at
  ) as Session[];
}

// ============================================================
// Event Operations
// ============================================================

/**
 * Insert an event
 */
export function insertEvent(event: Omit<SessionEvent, 'id'>): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO events (
      session_id, timestamp, event_type, content,
      tool_name, tool_input, tool_output, files_touched
    ) VALUES (
      @session_id, @timestamp, @event_type, @content,
      @tool_name, @tool_input, @tool_output, @files_touched
    )
  `);

  const result = stmt.run(event);
  return Number(result.lastInsertRowid);
}

/**
 * Insert multiple events in a transaction
 */
export function insertEvents(events: Omit<SessionEvent, 'id'>[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO events (
      session_id, timestamp, event_type, content,
      tool_name, tool_input, tool_output, files_touched
    ) VALUES (
      @session_id, @timestamp, @event_type, @content,
      @tool_name, @tool_input, @tool_output, @files_touched
    )
  `);

  const transaction = db.transaction((events: Omit<SessionEvent, 'id'>[]) => {
    for (const event of events) {
      stmt.run(event);
    }
  });

  transaction(events);
}

/**
 * Get events for a session
 * @param afterIndex - If provided, only return events with id > afterIndex (for incremental fetching)
 */
export function getSessionEvents(sessionId: string, afterIndex?: number): SessionEvent[] {
  const db = getDb();

  if (afterIndex != null && afterIndex > 0) {
    const stmt = db.prepare(
      'SELECT * FROM events WHERE session_id = ? AND id > ? ORDER BY timestamp ASC'
    );
    return stmt.all(sessionId, afterIndex) as SessionEvent[];
  }

  const stmt = db.prepare('SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC');
  return stmt.all(sessionId) as SessionEvent[];
}

/**
 * Delete events for a session (used during reindexing)
 */
export function deleteSessionEvents(sessionId: string): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM events WHERE session_id = ?');
  stmt.run(sessionId);
}

// ============================================================
// Search Operations
// ============================================================

/**
 * Index content for full-text search
 */
export function indexForSearch(
  sessionId: string,
  content: string,
  toolNames: string[],
  filesTouched: string[]
): void {
  const db = getDb();

  // First delete any existing search data for this session
  const deleteStmt = db.prepare('DELETE FROM session_search WHERE session_id = ?');
  deleteStmt.run(sessionId);

  // Insert new search data
  const insertStmt = db.prepare(`
    INSERT INTO session_search (session_id, content, tool_name, files_touched)
    VALUES (?, ?, ?, ?)
  `);

  insertStmt.run(
    sessionId,
    content,
    toolNames.join(' '),
    filesTouched.join(' ')
  );
}

/**
 * Search sessions using FTS5
 */
export function searchSessions(query: string): Session[] {
  const db = getDb();

  // Use FTS5 match syntax
  const stmt = db.prepare(`
    SELECT s.*
    FROM sessions s
    INNER JOIN session_search ss ON s.session_id = ss.session_id
    WHERE session_search MATCH ?
    ORDER BY bm25(session_search)
    LIMIT 50
  `);

  try {
    return stmt.all(query) as Session[];
  } catch {
    // If FTS query fails (bad syntax), fallback to LIKE search
    const fallbackStmt = db.prepare(`
      SELECT DISTINCT s.*
      FROM sessions s
      INNER JOIN session_search ss ON s.session_id = ss.session_id
      WHERE ss.content LIKE ?
         OR ss.tool_name LIKE ?
         OR ss.files_touched LIKE ?
      ORDER BY s.last_activity DESC
      LIMIT 50
    `);

    const likeQuery = `%${query}%`;
    return fallbackStmt.all(likeQuery, likeQuery, likeQuery) as Session[];
  }
}

// ============================================================
// Statistics
// ============================================================

/**
 * Get session statistics
 */
export function getStats(): SessionStats {
  const db = getDb();

  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM sessions');
  const activeStmt = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'active'");
  const idleStmt = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'idle'");
  const completedStmt = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'completed'");
  const todayStmt = db.prepare(`
    SELECT COUNT(*) as count FROM sessions
    WHERE date(indexed_at) = date('now')
  `);

  const total = (totalStmt.get() as { count: number }).count;
  const active = (activeStmt.get() as { count: number }).count;
  const idle = (idleStmt.get() as { count: number }).count;
  const completed = (completedStmt.get() as { count: number }).count;
  const indexed_today = (todayStmt.get() as { count: number }).count;

  return {
    total,
    active,
    idle,
    completed,
    indexed_today,
  };
}

/**
 * Get count of sessions that need reindexing (file modified after indexed_at)
 */
export function getStaleSessionCount(): number {
  // This would require checking file modification times externally
  // For now, return 0 as this will be handled by the indexer
  void getDb(); // Ensure db is initialized
  return 0;
}

// ============================================================
// Cross-Session Intelligence
// ============================================================

export interface FileConflict {
  file_path: string;
  sessions: Array<{ session_id: string; slug: string; project_name: string }>;
}

/**
 * Get files that are being modified by multiple active/idle sessions
 */
export function getFileConflicts(): FileConflict[] {
  const db = getDb();

  // Get Write/Edit events from active/idle sessions
  const stmt = db.prepare(`
    SELECT e.files_touched, e.session_id, s.slug, s.project_name
    FROM events e
    INNER JOIN sessions s ON e.session_id = s.session_id
    WHERE e.tool_name IN ('Write', 'Edit')
      AND e.files_touched IS NOT NULL
      AND s.status IN ('active', 'idle')
  `);

  const rows = stmt.all() as Array<{
    files_touched: string;
    session_id: string;
    slug: string;
    project_name: string;
  }>;

  // Aggregate files by session
  const fileToSessions = new Map<string, Set<string>>();
  const sessionInfo = new Map<string, { slug: string; project_name: string }>();

  for (const row of rows) {
    sessionInfo.set(row.session_id, { slug: row.slug, project_name: row.project_name });
    const files = row.files_touched.split(',').filter(f => f.trim());
    for (const file of files) {
      const trimmedFile = file.trim();
      if (!fileToSessions.has(trimmedFile)) fileToSessions.set(trimmedFile, new Set());
      fileToSessions.get(trimmedFile)!.add(row.session_id);
    }
  }

  // Return only files with 2+ sessions
  return Array.from(fileToSessions.entries())
    .filter(([, sids]) => sids.size >= 2)
    .map(([file_path, sessionIds]) => ({
      file_path,
      sessions: Array.from(sessionIds).map(sid => ({
        session_id: sid,
        ...sessionInfo.get(sid)!
      }))
    }));
}

/**
 * Get sessions that touch the same files as the given session
 */
export function getRelatedSessions(sessionId: string): Session[] {
  const db = getDb();

  // Get files touched by target session
  const filesStmt = db.prepare(`
    SELECT DISTINCT files_touched FROM events
    WHERE session_id = ? AND files_touched IS NOT NULL
  `);
  const targetFiles = new Set<string>();
  for (const row of filesStmt.all(sessionId) as { files_touched: string }[]) {
    row.files_touched.split(',').forEach(f => f.trim() && targetFiles.add(f.trim()));
  }

  if (targetFiles.size === 0) return [];

  // Find other sessions touching same files
  const stmt = db.prepare(`
    SELECT DISTINCT s.* FROM sessions s
    INNER JOIN events e ON s.session_id = e.session_id
    WHERE s.session_id != ? AND e.files_touched IS NOT NULL
    ORDER BY s.last_activity DESC LIMIT 20
  `);

  const candidates = stmt.all(sessionId) as Session[];

  // Filter to sessions that actually share files
  return candidates.filter(session => {
    const theirFilesStmt = db.prepare(
      `SELECT files_touched FROM events WHERE session_id = ? AND files_touched IS NOT NULL`
    );
    const theirFiles = theirFilesStmt.all(session.session_id) as { files_touched: string }[];

    return theirFiles.some(row =>
      row.files_touched.split(',').some(f => targetFiles.has(f.trim()))
    );
  }).slice(0, 10);
}

// ============================================================
// Maintenance
// ============================================================

/**
 * Vacuum the database to reclaim space
 */
export function vacuum(): void {
  const db = getDb();
  db.exec('VACUUM');
  console.log('[Database] Vacuumed');
}

/**
 * Get database file size in bytes
 */
export function getDbSize(): number {
  const dbPath = getDbPath();
  try {
    const stats = fs.statSync(dbPath);
    return stats.size;
  } catch {
    return 0;
  }
}

// ============================================================
// Insights Queries
// ============================================================

export interface SessionWithEvents extends Session {
  events: SessionEvent[];
}

/**
 * Get recent sessions with their full events for pattern analysis
 */
export function getSessionsWithEvents(limit: number = 50): SessionWithEvents[] {
  const db = getDb();

  // Get recent sessions
  const sessionsStmt = db.prepare(`
    SELECT * FROM sessions
    ORDER BY last_activity DESC
    LIMIT ?
  `);
  const sessions = sessionsStmt.all(limit) as Session[];

  // Get events for each session
  const eventsStmt = db.prepare(`
    SELECT * FROM events
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `);

  return sessions.map(session => ({
    ...session,
    events: eventsStmt.all(session.session_id) as SessionEvent[],
  }));
}

export interface ToolUsageStats {
  tool: string;
  count: number;
  errorCount: number;
  errorRate: number;
}

/**
 * Get tool usage statistics from all sessions
 */
export function getToolUsageStats(): ToolUsageStats[] {
  const db = getDb();

  // Get all tool calls with their outputs
  const stmt = db.prepare(`
    SELECT
      tool_name,
      COUNT(*) as count,
      SUM(CASE
        WHEN tool_output LIKE '%error%'
          OR tool_output LIKE '%failed%'
          OR tool_output LIKE '%exception%'
        THEN 1
        ELSE 0
      END) as error_count
    FROM events
    WHERE tool_name IS NOT NULL
    GROUP BY tool_name
    ORDER BY count DESC
  `);

  const rows = stmt.all() as Array<{
    tool_name: string;
    count: number;
    error_count: number;
  }>;

  return rows.map(row => ({
    tool: row.tool_name,
    count: row.count,
    errorCount: row.error_count,
    errorRate: Math.round((row.error_count / row.count) * 100),
  }));
}

export interface FileModificationFrequency {
  file: string;
  count: number;
  sessions: string[];
}

/**
 * Get file modification frequency across all sessions
 */
export function getFileModificationFrequency(limit: number = 50): FileModificationFrequency[] {
  const db = getDb();

  // Get all Write/Edit events with files
  const stmt = db.prepare(`
    SELECT session_id, files_touched
    FROM events
    WHERE tool_name IN ('Write', 'Edit')
      AND files_touched IS NOT NULL
  `);

  const rows = stmt.all() as Array<{
    session_id: string;
    files_touched: string;
  }>;

  // Aggregate by file
  const fileMap = new Map<string, Set<string>>();

  for (const row of rows) {
    const files = row.files_touched.split(',').map(f => f.trim()).filter(Boolean);
    for (const file of files) {
      if (!fileMap.has(file)) {
        fileMap.set(file, new Set());
      }
      fileMap.get(file)!.add(row.session_id);
    }
  }

  // Convert to array and sort by count
  return Array.from(fileMap.entries())
    .map(([file, sessionIds]) => ({
      file,
      count: sessionIds.size,
      sessions: Array.from(sessionIds),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get session count by day for the last N days
 */
export function getSessionCountByDay(days: number = 30): Array<{ date: string; count: number }> {
  const db = getDb();

  const stmt = db.prepare(`
    SELECT
      date(started_at) as date,
      COUNT(*) as count
    FROM sessions
    WHERE started_at >= date('now', '-' || ? || ' days')
    GROUP BY date(started_at)
    ORDER BY date ASC
  `);

  return stmt.all(days) as Array<{ date: string; count: number }>;
}
