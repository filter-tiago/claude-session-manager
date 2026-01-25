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
  `);

  console.log('[Database] Initialized at:', dbPath);
  return db;
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
 * Get all sessions, optionally filtered by status
 */
export function getSessions(status?: string): Session[] {
  const db = getDb();

  if (status) {
    const stmt = db.prepare('SELECT * FROM sessions WHERE status = ? ORDER BY last_activity DESC');
    return stmt.all(status) as Session[];
  }

  const stmt = db.prepare('SELECT * FROM sessions ORDER BY last_activity DESC');
  return stmt.all() as Session[];
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
 */
export function getSessionEvents(sessionId: string, limit?: number): SessionEvent[] {
  const db = getDb();

  if (limit) {
    const stmt = db.prepare(
      'SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC LIMIT ?'
    );
    return stmt.all(sessionId, limit) as SessionEvent[];
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
