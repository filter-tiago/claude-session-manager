/**
 * AI-Powered Search Service for Claude Session Manager
 *
 * Two-tier search across 5K+ Claude CLI sessions:
 * 1. FTS5 pre-filter: BM25-ranked SQLite full-text search
 * 2. AI tier: Claude CLI analysis of pre-filtered context
 *
 * Also scans continuity ledger files for cross-session context.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getDb } from './database';
import type { Session } from '../../src/types/electron';

const execAsync = promisify(exec);

// ============================================================
// Types
// ============================================================

export interface AISearchQuery {
  query: string;
  scope?: 'sessions' | 'ledgers' | 'all';
  projectFilter?: string;
  maxResults?: number;
}

export interface AISearchMatch {
  type: 'session' | 'ledger';
  id: string;
  title: string;
  relevance: number;
  evidence: string;
  path?: string;
  sessionId?: string;
  projectName?: string;
}

export interface AISearchResult {
  query: string;
  matches: AISearchMatch[];
  summary: string;
  searchedAt: string;
  durationMs: number;
  tier: 'fts' | 'ai';
}

// ============================================================
// FTS5 Pre-Filter
// ============================================================

/**
 * Build a compact context string from FTS5-ranked sessions and ledger files.
 *
 * Steps:
 * 1. FTS5 MATCH query with BM25 ranking -> top 50 results
 * 2. Optional project_path filter
 * 3. Take top 20 and build ~200-byte summaries
 * 4. Scan thoughts/ledgers/ for CONTINUITY_*.md files (first 10 lines each)
 * 5. Return combined context (~6KB max)
 */
export async function buildPreFilteredContext(
  query: string,
  projectFilter?: string
): Promise<string> {
  const db = getDb();
  const parts: string[] = [];

  // --- FTS5 session search ---
  let sessions: Session[] = [];

  try {
    if (projectFilter) {
      const stmt = db.prepare(`
        SELECT s.*
        FROM sessions s
        INNER JOIN session_search ss ON s.session_id = ss.session_id
        WHERE session_search MATCH ?
          AND s.project_path = ?
        ORDER BY bm25(session_search)
        LIMIT 50
      `);
      sessions = stmt.all(query, projectFilter) as Session[];
    } else {
      const stmt = db.prepare(`
        SELECT s.*
        FROM sessions s
        INNER JOIN session_search ss ON s.session_id = ss.session_id
        WHERE session_search MATCH ?
        ORDER BY bm25(session_search)
        LIMIT 50
      `);
      sessions = stmt.all(query) as Session[];
    }
  } catch (error) {
    // FTS5 query syntax error - fall back to LIKE search
    console.log('[AI Search] FTS5 MATCH failed, falling back to LIKE search:', error);

    try {
      const likeQuery = `%${query}%`;
      if (projectFilter) {
        const stmt = db.prepare(`
          SELECT DISTINCT s.*
          FROM sessions s
          INNER JOIN session_search ss ON s.session_id = ss.session_id
          WHERE (ss.content LIKE ? OR ss.tool_name LIKE ? OR ss.files_touched LIKE ?)
            AND s.project_path = ?
          ORDER BY s.last_activity DESC
          LIMIT 50
        `);
        sessions = stmt.all(likeQuery, likeQuery, likeQuery, projectFilter) as Session[];
      } else {
        const stmt = db.prepare(`
          SELECT DISTINCT s.*
          FROM sessions s
          INNER JOIN session_search ss ON s.session_id = ss.session_id
          WHERE ss.content LIKE ? OR ss.tool_name LIKE ? OR ss.files_touched LIKE ?
          ORDER BY s.last_activity DESC
          LIMIT 50
        `);
        sessions = stmt.all(likeQuery, likeQuery, likeQuery) as Session[];
      }
    } catch (fallbackError) {
      console.error('[AI Search] LIKE fallback also failed:', fallbackError);
    }
  }

  // Take top 20 and build compact summaries
  const topSessions = sessions.slice(0, 20);

  if (topSessions.length > 0) {
    parts.push('=== SESSION MATCHES ===');

    for (const s of topSessions) {
      const ago = formatTimeAgo(s.last_activity);
      const task = s.detected_task ? truncate(s.detected_task, 60) : 'unknown';
      const activity = s.detected_activity || 'unknown';
      const area = s.detected_area || 'unknown';
      const projectName = s.project_name || path.basename(s.project_path);

      // Build ~200-byte summary
      const summary = [
        `Session ${s.slug} | project: ${projectName} | status: ${s.status}`,
        `Task: "${task}" | Activity: ${activity} | Area: ${area}`,
        `Files: ${getTopFiles(s.session_id, 3)} | Tools: ${getTopTools(s.session_id, 3)}`,
        `Last: ${ago} | Messages: ${s.message_count}`,
      ].join('\n');

      parts.push(summary);
      parts.push('');
    }
  }

  // --- Ledger scanning ---
  try {
    const ledgerContext = await scanLedgerFiles();
    if (ledgerContext) {
      parts.push('=== LEDGER FILES ===');
      parts.push(ledgerContext);
    }
  } catch (error) {
    console.log('[AI Search] Ledger scan failed:', error);
  }

  // Combine and cap at ~6KB
  const combined = parts.join('\n');
  return truncate(combined, 6000);
}

/**
 * Scan thoughts/ledgers/ for CONTINUITY_*.md files and extract first 10 lines each.
 */
async function scanLedgerFiles(): Promise<string> {
  const ledgerParts: string[] = [];

  // Look for ledger directories in common project locations
  const cwd = process.cwd();
  const searchPaths = [
    path.join(cwd, 'thoughts', 'ledgers'),
  ];

  for (const searchPath of searchPaths) {
    try {
      const dirEntries = await fs.readdir(searchPath);
      const files = dirEntries
        .filter(f => f.startsWith('CONTINUITY_') && f.endsWith('.md'))
        .map(f => path.join(searchPath, f));

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n').slice(0, 10);
          const filename = path.basename(filePath);

          ledgerParts.push(`--- ${filename} ---`);
          ledgerParts.push(lines.join('\n'));
          ledgerParts.push('');
        } catch (readError) {
          console.log(`[AI Search] Could not read ledger ${filePath}:`, readError);
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return ledgerParts.join('\n');
}

/**
 * Get the top N file names touched by a session (from events table).
 */
function getTopFiles(sessionId: string, count: number): string {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT files_touched FROM events
      WHERE session_id = ? AND files_touched IS NOT NULL AND files_touched != ''
      ORDER BY timestamp DESC
      LIMIT 20
    `);
    const rows = stmt.all(sessionId) as Array<{ files_touched: string }>;

    const fileSet = new Set<string>();
    for (const row of rows) {
      const files = row.files_touched.split(',').map(f => f.trim()).filter(Boolean);
      for (const f of files) {
        fileSet.add(path.basename(f));
        if (fileSet.size >= count) break;
      }
      if (fileSet.size >= count) break;
    }

    return fileSet.size > 0 ? Array.from(fileSet).join(', ') : 'none';
  } catch {
    return 'none';
  }
}

/**
 * Get the top N tool names used by a session (from events table).
 */
function getTopTools(sessionId: string, count: number): string {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT tool_name, COUNT(*) as cnt FROM events
      WHERE session_id = ? AND tool_name IS NOT NULL
      GROUP BY tool_name
      ORDER BY cnt DESC
      LIMIT ?
    `);
    const rows = stmt.all(sessionId, count) as Array<{ tool_name: string; cnt: number }>;

    return rows.length > 0
      ? rows.map(r => r.tool_name).join(', ')
      : 'none';
  } catch {
    return 'none';
  }
}

// ============================================================
// Claude CLI Invocation
// ============================================================

/**
 * Invoke the Claude CLI in non-interactive, print-only mode.
 *
 * Runs:
 *   claude --print --output-format json --model sonnet \
 *     --max-budget-usd 0.05 --no-session-persistence \
 *     --allowedTools "" --system-prompt "<prompt>" "<query>"
 *
 * Handles:
 * - Timeout (default 30s)
 * - JSON parse errors
 * - Budget exceeded errors
 * - Process spawn failures
 */
export async function invokeClaudeCLI(
  systemPrompt: string,
  query: string,
  timeoutMs: number = 30000
): Promise<any> {
  // Escape for shell - replace single quotes with escaped version
  const escapedPrompt = systemPrompt.replace(/'/g, "'\\''");
  const escapedQuery = query.replace(/'/g, "'\\''");

  const command = [
    'claude',
    '--print',
    '--output-format', 'json',
    '--model', 'sonnet',
    '--max-budget-usd', '0.05',
    '--no-session-persistence',
    '--allowedTools', '""',
    '--system-prompt', `'${escapedPrompt}'`,
    `'${escapedQuery}'`,
  ].join(' ');

  console.log('[AI Search] Invoking Claude CLI...');

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024, // 1MB
      env: { ...process.env },
    });

    if (stderr) {
      console.log('[AI Search] CLI stderr:', stderr.substring(0, 200));
    }

    // Parse JSON from stdout
    const trimmed = stdout.trim();
    if (!trimmed) {
      throw new Error('Claude CLI returned empty output');
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      // Sometimes the output is text with embedded JSON - try to extract it
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Return as plain text result if no JSON found
      console.log('[AI Search] CLI output is not JSON, returning as text');
      return { result: trimmed };
    }
  } catch (error: any) {
    if (error.killed || error.signal === 'SIGTERM') {
      console.error(`[AI Search] CLI timed out after ${timeoutMs}ms`);
      throw new Error(`Claude CLI timed out after ${timeoutMs}ms`);
    }

    if (error.message?.includes('budget')) {
      console.error('[AI Search] CLI budget exceeded');
      throw new Error('Claude CLI budget exceeded ($0.05 limit)');
    }

    if (error.code === 'ENOENT') {
      console.error('[AI Search] Claude CLI not found in PATH');
      throw new Error('Claude CLI not found. Ensure "claude" is in your PATH.');
    }

    console.error('[AI Search] CLI error:', error.message?.substring(0, 200));
    throw error;
  }
}

// ============================================================
// AI Search (Main Entry Point)
// ============================================================

/**
 * AI-powered search across sessions and ledgers.
 *
 * 1. Builds pre-filtered context from FTS5 + ledger scan
 * 2. Constructs a system prompt for Claude to analyze and rank matches
 * 3. Invokes Claude CLI with the context
 * 4. Parses and enriches the result with full session data
 */
export async function aiSearch(options: AISearchQuery): Promise<AISearchResult> {
  const {
    query,
    scope = 'all',
    projectFilter,
    maxResults = 10,
  } = options;

  const startTime = Date.now();

  console.log(`[AI Search] Starting AI search: "${query}" (scope: ${scope}, project: ${projectFilter || 'all'})`);

  // Step 1: Build pre-filtered context
  const context = await buildPreFilteredContext(query, projectFilter);

  if (!context.trim()) {
    console.log('[AI Search] No pre-filtered context found');
    return {
      query,
      matches: [],
      summary: 'No matching sessions or ledgers found.',
      searchedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      tier: 'ai',
    };
  }

  // Step 2: Build system prompt
  const systemPrompt = buildSystemPrompt(scope, maxResults);

  // Step 3: Build the user query with context
  const fullQuery = [
    `Search query: "${query}"`,
    '',
    'Context (pre-filtered sessions and ledgers):',
    context,
  ].join('\n');

  // Step 4: Invoke Claude CLI
  let cliResult: any;
  try {
    cliResult = await invokeClaudeCLI(systemPrompt, fullQuery);
  } catch (error) {
    console.error('[AI Search] CLI invocation failed:', error);
    return {
      query,
      matches: [],
      summary: `AI search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      searchedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      tier: 'ai',
    };
  }

  // Step 5: Parse and enrich results
  const matches = parseAndEnrichMatches(cliResult, maxResults);
  const summary = extractSummary(cliResult);

  const result: AISearchResult = {
    query,
    matches,
    summary,
    searchedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    tier: 'ai',
  };

  console.log(`[AI Search] AI search complete: ${matches.length} matches in ${result.durationMs}ms`);
  return result;
}

/**
 * Build the system prompt that tells Claude how to analyze sessions.
 */
function buildSystemPrompt(scope: string, maxResults: number): string {
  const scopeInstruction = scope === 'sessions'
    ? 'Only analyze SESSION MATCHES, ignore ledger files.'
    : scope === 'ledgers'
      ? 'Only analyze LEDGER FILES, ignore session matches.'
      : 'Analyze both SESSION MATCHES and LEDGER FILES.';

  return [
    'You are a search analyst for a Claude session management system.',
    'You receive pre-filtered context about Claude CLI sessions and continuity ledger files.',
    '',
    `${scopeInstruction}`,
    '',
    'Analyze the provided context against the user search query.',
    `Return a JSON object with exactly this structure (max ${maxResults} matches):`,
    '',
    '{',
    '  "matches": [',
    '    {',
    '      "type": "session" or "ledger",',
    '      "id": "session slug (e.g. ea1b2c3d) or ledger filename",',
    '      "title": "brief descriptive title of what this session/ledger is about",',
    '      "relevance": 0-100 (how relevant to the query),',
    '      "evidence": "one-sentence explanation of why this matches"',
    '    }',
    '  ],',
    '  "summary": "one-line summary of what was found"',
    '}',
    '',
    'Rules:',
    '- Only include matches with relevance >= 30',
    '- Sort by relevance descending',
    '- Be precise with evidence - cite specific details from the context',
    '- If nothing matches, return empty matches array',
    '- Return ONLY valid JSON, no markdown fences or extra text',
  ].join('\n');
}

/**
 * Parse CLI result and enrich session matches with full data from the database.
 */
function parseAndEnrichMatches(cliResult: any, maxResults: number): AISearchMatch[] {
  const matches: AISearchMatch[] = [];

  // Extract matches array from result
  let rawMatches: any[] = [];

  if (Array.isArray(cliResult?.matches)) {
    rawMatches = cliResult.matches;
  } else if (typeof cliResult?.result === 'string') {
    // Try to parse text result as JSON
    try {
      const parsed = JSON.parse(cliResult.result);
      if (Array.isArray(parsed?.matches)) {
        rawMatches = parsed.matches;
      }
    } catch {
      // Not parseable
    }
  }

  for (const raw of rawMatches.slice(0, maxResults)) {
    const match: AISearchMatch = {
      type: raw.type === 'ledger' ? 'ledger' : 'session',
      id: String(raw.id || ''),
      title: String(raw.title || 'Untitled'),
      relevance: typeof raw.relevance === 'number' ? Math.min(100, Math.max(0, raw.relevance)) : 0,
      evidence: String(raw.evidence || ''),
    };

    // Enrich session matches with full data
    if (match.type === 'session' && match.id) {
      const session = findSessionBySlug(match.id);
      if (session) {
        match.sessionId = session.session_id;
        match.projectName = session.project_name || path.basename(session.project_path);
        match.path = session.file_path;
      }
    }

    // Enrich ledger matches with path
    if (match.type === 'ledger' && match.id) {
      const ledgerPath = path.join(process.cwd(), 'thoughts', 'ledgers', match.id);
      match.path = ledgerPath;
    }

    matches.push(match);
  }

  // Sort by relevance descending
  matches.sort((a, b) => b.relevance - a.relevance);

  return matches;
}

/**
 * Extract summary string from CLI result.
 */
function extractSummary(cliResult: any): string {
  if (typeof cliResult?.summary === 'string') {
    return cliResult.summary;
  }

  if (typeof cliResult?.result === 'string') {
    try {
      const parsed = JSON.parse(cliResult.result);
      if (typeof parsed?.summary === 'string') {
        return parsed.summary;
      }
    } catch {
      // Not parseable
    }
  }

  return 'AI analysis complete.';
}

/**
 * Find a session by its slug (first 8 chars of session_id).
 */
function findSessionBySlug(slug: string): Session | null {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM sessions
      WHERE slug = ? OR session_id LIKE ?
      LIMIT 1
    `);
    const result = stmt.get(slug, `${slug}%`) as Session | undefined;
    return result || null;
  } catch {
    return null;
  }
}

// ============================================================
// Hybrid Search
// ============================================================

/**
 * Two-tier hybrid search:
 *
 * Tier 1 (FTS): If FTS5 returns 5+ matches, return them directly.
 *   This is fast (<10ms) and avoids the Claude CLI overhead.
 *
 * Tier 2 (AI): If FTS5 returns fewer than 5 matches,
 *   escalate to AI search for semantic understanding.
 */
export async function hybridSearch(
  query: string,
  projectFilter?: string
): Promise<AISearchResult> {
  const startTime = Date.now();

  console.log(`[AI Search] Hybrid search: "${query}" (project: ${projectFilter || 'all'})`);

  // --- Tier 1: FTS5 search ---
  const ftsMatches = ftsSearch(query, projectFilter);

  if (ftsMatches.length >= 5) {
    console.log(`[AI Search] FTS tier: ${ftsMatches.length} matches, skipping AI`);

    return {
      query,
      matches: ftsMatches.slice(0, 20),
      summary: `Found ${ftsMatches.length} sessions matching "${query}" via full-text search.`,
      searchedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      tier: 'fts',
    };
  }

  console.log(`[AI Search] FTS tier: only ${ftsMatches.length} matches, escalating to AI`);

  // --- Tier 2: AI search ---
  const aiResult = await aiSearch({
    query,
    scope: 'all',
    projectFilter,
  });

  // Merge FTS matches into AI results if they aren't already present
  const aiIds = new Set(aiResult.matches.map(m => m.id));
  for (const ftsMatch of ftsMatches) {
    if (!aiIds.has(ftsMatch.id)) {
      aiResult.matches.push(ftsMatch);
    }
  }

  // Re-sort by relevance
  aiResult.matches.sort((a, b) => b.relevance - a.relevance);

  aiResult.durationMs = Date.now() - startTime;
  return aiResult;
}

/**
 * Run FTS5 search and convert results to AISearchMatch format.
 */
function ftsSearch(query: string, projectFilter?: string): AISearchMatch[] {
  const db = getDb();
  let sessions: Session[] = [];

  try {
    if (projectFilter) {
      const stmt = db.prepare(`
        SELECT s.*, bm25(session_search) as rank
        FROM sessions s
        INNER JOIN session_search ss ON s.session_id = ss.session_id
        WHERE session_search MATCH ?
          AND s.project_path = ?
        ORDER BY bm25(session_search)
        LIMIT 50
      `);
      sessions = stmt.all(query, projectFilter) as Session[];
    } else {
      const stmt = db.prepare(`
        SELECT s.*, bm25(session_search) as rank
        FROM sessions s
        INNER JOIN session_search ss ON s.session_id = ss.session_id
        WHERE session_search MATCH ?
        ORDER BY bm25(session_search)
        LIMIT 50
      `);
      sessions = stmt.all(query) as Session[];
    }
  } catch {
    // FTS5 syntax error - fall back to LIKE
    try {
      const likeQuery = `%${query}%`;
      if (projectFilter) {
        const stmt = db.prepare(`
          SELECT DISTINCT s.*
          FROM sessions s
          INNER JOIN session_search ss ON s.session_id = ss.session_id
          WHERE (ss.content LIKE ? OR ss.tool_name LIKE ? OR ss.files_touched LIKE ?)
            AND s.project_path = ?
          ORDER BY s.last_activity DESC
          LIMIT 50
        `);
        sessions = stmt.all(likeQuery, likeQuery, likeQuery, projectFilter) as Session[];
      } else {
        const stmt = db.prepare(`
          SELECT DISTINCT s.*
          FROM sessions s
          INNER JOIN session_search ss ON s.session_id = ss.session_id
          WHERE ss.content LIKE ? OR ss.tool_name LIKE ? OR ss.files_touched LIKE ?
          ORDER BY s.last_activity DESC
          LIMIT 50
        `);
        sessions = stmt.all(likeQuery, likeQuery, likeQuery) as Session[];
      }
    } catch (fallbackError) {
      console.error('[AI Search] FTS LIKE fallback failed:', fallbackError);
    }
  }

  return sessions.map((s, index) => {
    const projectName = s.project_name || path.basename(s.project_path);
    // Approximate relevance: top result = 90, decaying by position
    const relevance = Math.max(10, 90 - index * 4);

    return {
      type: 'session' as const,
      id: s.slug,
      title: s.detected_task || s.name || `Session in ${projectName}`,
      relevance,
      evidence: `Status: ${s.status}, Activity: ${s.detected_activity || 'unknown'}, Messages: ${s.message_count}`,
      sessionId: s.session_id,
      projectName,
      path: s.file_path,
    };
  });
}

// ============================================================
// Distinct Projects
// ============================================================

/**
 * Get a sorted list of distinct project paths from all indexed sessions.
 */
export async function getDistinctProjectPaths(): Promise<string[]> {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT DISTINCT project_path
    FROM sessions
    WHERE project_path IS NOT NULL AND project_path != ''
    ORDER BY project_path ASC
  `);
  const rows = stmt.all() as Array<{ project_path: string }>;
  return rows.map(r => r.project_path);
}

// ============================================================
// Utility Helpers
// ============================================================

/**
 * Format a timestamp as a human-readable relative time string.
 */
function formatTimeAgo(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;

  if (isNaN(then)) return 'unknown';

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return `${Math.floor(days / 7)}w ago`;
}

/**
 * Truncate a string to maxLen, appending "..." if truncated.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}
