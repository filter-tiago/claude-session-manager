/**
 * Session Pattern Analyzer Service
 *
 * Analyzes session history to detect corrections and mine workflow patterns.
 *
 * Correction Detection:
 * - Same file edited twice within 60 seconds → likely correction
 * - Bash command followed by same command → retry
 * - Tool output contains error + next event is Edit → error fix
 * - Write immediately followed by Edit to same file → quick fix
 *
 * Workflow Mining:
 * - Groups consecutive tool calls into sequences
 * - Normalizes sequences (ignores Read-only)
 * - Counts frequency across sessions
 * - Calculates success rate
 */

import type { SessionEvent } from '../../src/types/electron';
import type { SessionWithEvents } from './database';

// ============================================================================
// Types
// ============================================================================

export interface CorrectionPattern {
  sessionId: string;
  timestamp: string;
  type: 'file_revert' | 'undo_edit' | 'retry_command' | 'error_fix';
  context: string;
  filesAffected: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface WorkflowPattern {
  name: string;
  sequence: string[];
  frequency: number;
  avgDurationMs: number;
  successRate: number;
  examples: Array<{ sessionId: string; timestamp: string }>;
}

// ============================================================================
// Correction Detection
// ============================================================================

const CORRECTION_WINDOW_MS = 60 * 1000; // 60 seconds

/**
 * Extract file paths from files_touched field
 */
function parseFilesTouched(filesTouched?: string): string[] {
  if (!filesTouched) return [];
  return filesTouched.split(',').map(f => f.trim()).filter(Boolean);
}

/**
 * Normalize a bash command for comparison (ignore whitespace variations)
 */
function normalizeCommand(cmd: string): string {
  return cmd.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Check if tool output indicates an error
 */
function hasErrorInOutput(output?: string): boolean {
  if (!output) return false;
  const lowerOutput = output.toLowerCase();
  return (
    lowerOutput.includes('error') ||
    lowerOutput.includes('failed') ||
    lowerOutput.includes('exception') ||
    lowerOutput.includes('cannot') ||
    lowerOutput.includes('unable to') ||
    lowerOutput.includes('not found') ||
    lowerOutput.includes('permission denied')
  );
}

/**
 * Detect correction patterns in session events
 */
export function detectCorrections(events: SessionEvent[], sessionId: string): CorrectionPattern[] {
  const corrections: CorrectionPattern[] = [];

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];

    const prevTime = new Date(prev.timestamp).getTime();
    const currTime = new Date(curr.timestamp).getTime();
    const timeDiff = currTime - prevTime;

    // 1. Same file edited twice within 60 seconds → potential correction
    if (
      prev.tool_name === 'Edit' &&
      curr.tool_name === 'Edit' &&
      timeDiff < CORRECTION_WINDOW_MS
    ) {
      const prevFiles = parseFilesTouched(prev.files_touched);
      const currFiles = parseFilesTouched(curr.files_touched);
      const sharedFiles = prevFiles.filter(f => currFiles.includes(f));

      if (sharedFiles.length > 0) {
        corrections.push({
          sessionId,
          timestamp: curr.timestamp,
          type: 'undo_edit',
          context: `Edited ${sharedFiles[0]} twice within ${Math.round(timeDiff / 1000)}s`,
          filesAffected: sharedFiles,
          severity: timeDiff < 10000 ? 'high' : 'medium',
        });
      }
    }

    // 2. Write immediately followed by Edit to same file → quick fix
    if (
      prev.tool_name === 'Write' &&
      curr.tool_name === 'Edit' &&
      timeDiff < CORRECTION_WINDOW_MS
    ) {
      const prevFiles = parseFilesTouched(prev.files_touched);
      const currFiles = parseFilesTouched(curr.files_touched);
      const sharedFiles = prevFiles.filter(f => currFiles.includes(f));

      if (sharedFiles.length > 0) {
        corrections.push({
          sessionId,
          timestamp: curr.timestamp,
          type: 'file_revert',
          context: `Wrote then edited ${sharedFiles[0]} within ${Math.round(timeDiff / 1000)}s`,
          filesAffected: sharedFiles,
          severity: 'medium',
        });
      }
    }

    // 3. Bash command followed by same command → retry
    if (
      prev.tool_name === 'Bash' &&
      curr.tool_name === 'Bash' &&
      prev.tool_input &&
      curr.tool_input
    ) {
      try {
        const prevInput = JSON.parse(prev.tool_input);
        const currInput = JSON.parse(curr.tool_input);

        if (
          prevInput.command &&
          currInput.command &&
          normalizeCommand(prevInput.command) === normalizeCommand(currInput.command)
        ) {
          corrections.push({
            sessionId,
            timestamp: curr.timestamp,
            type: 'retry_command',
            context: `Retried command: ${currInput.command.substring(0, 50)}...`,
            filesAffected: [],
            severity: hasErrorInOutput(prev.tool_output) ? 'high' : 'low',
          });
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // 4. Error in output → subsequent edit = error correction
    if (hasErrorInOutput(prev.tool_output) && curr.tool_name === 'Edit') {
      const currFiles = parseFilesTouched(curr.files_touched);
      corrections.push({
        sessionId,
        timestamp: curr.timestamp,
        type: 'error_fix',
        context: `Fixed after error in ${prev.tool_name || 'unknown'}`,
        filesAffected: currFiles,
        severity: 'high',
      });
    }
  }

  return corrections;
}

/**
 * Get corrections from multiple sessions
 */
export function detectCorrectionsFromSessions(
  sessions: SessionWithEvents[],
  limit?: number
): CorrectionPattern[] {
  const allCorrections: CorrectionPattern[] = [];

  for (const session of sessions) {
    const corrections = detectCorrections(session.events, session.session_id);
    allCorrections.push(...corrections);
  }

  // Sort by timestamp descending (most recent first)
  allCorrections.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return limit ? allCorrections.slice(0, limit) : allCorrections;
}

// ============================================================================
// Workflow Mining
// ============================================================================

const MIN_SEQUENCE_LENGTH = 2;
const MAX_SEQUENCE_LENGTH = 5;
const MIN_FREQUENCY = 3;

// Tools to ignore when building sequences (read-only/passive tools)
const PASSIVE_TOOLS = new Set(['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch']);

/**
 * Extract meaningful tool sequences from events
 */
function extractSequences(events: SessionEvent[]): Array<{
  sequence: string[];
  startTime: string;
  endTime: string;
}> {
  const sequences: Array<{
    sequence: string[];
    startTime: string;
    endTime: string;
  }> = [];

  // Filter to active tools only
  const activeEvents = events.filter(e =>
    e.tool_name && !PASSIVE_TOOLS.has(e.tool_name)
  );

  // Extract sliding windows of tool sequences
  for (let len = MIN_SEQUENCE_LENGTH; len <= MAX_SEQUENCE_LENGTH; len++) {
    for (let i = 0; i <= activeEvents.length - len; i++) {
      const window = activeEvents.slice(i, i + len);
      sequences.push({
        sequence: window.map(e => e.tool_name!),
        startTime: window[0].timestamp,
        endTime: window[window.length - 1].timestamp,
      });
    }
  }

  return sequences;
}

/**
 * Generate a readable name for a workflow pattern
 */
function generatePatternName(sequence: string[]): string {
  if (sequence.length === 0) return 'Empty';

  // Common patterns get special names
  const key = sequence.join('→');

  const namedPatterns: Record<string, string> = {
    'Edit→Bash': 'Edit-Test Cycle',
    'Write→Bash': 'Write-Run',
    'Edit→Edit': 'Multi-Edit',
    'Bash→Edit': 'Fix After Run',
    'Write→Edit→Bash': 'Create-Fix-Test',
    'Edit→Bash→Edit': 'Test-Fix Cycle',
    'Write→Bash→Edit': 'Write-Test-Fix',
  };

  return namedPatterns[key] || `${sequence[0]}→...→${sequence[sequence.length - 1]}`;
}

/**
 * Check if a session completed successfully (no errors in last events)
 */
function sessionCompletedSuccessfully(events: SessionEvent[]): boolean {
  if (events.length === 0) return true;

  // Check last 3 events for errors
  const lastEvents = events.slice(-3);
  return !lastEvents.some(e => hasErrorInOutput(e.tool_output));
}

/**
 * Mine workflow patterns from multiple sessions
 */
export function mineWorkflows(sessions: SessionWithEvents[]): WorkflowPattern[] {
  // Track pattern occurrences
  const patternMap = new Map<string, {
    sequence: string[];
    occurrences: Array<{
      sessionId: string;
      timestamp: string;
      durationMs: number;
      success: boolean;
    }>;
  }>();

  for (const session of sessions) {
    const sequences = extractSequences(session.events);
    const sessionSuccess = sessionCompletedSuccessfully(session.events);

    for (const seq of sequences) {
      const key = seq.sequence.join('→');

      if (!patternMap.has(key)) {
        patternMap.set(key, {
          sequence: seq.sequence,
          occurrences: [],
        });
      }

      const startMs = new Date(seq.startTime).getTime();
      const endMs = new Date(seq.endTime).getTime();

      patternMap.get(key)!.occurrences.push({
        sessionId: session.session_id,
        timestamp: seq.startTime,
        durationMs: endMs - startMs,
        success: sessionSuccess,
      });
    }
  }

  // Convert to patterns and filter by frequency
  const patterns: WorkflowPattern[] = [];

  for (const [, data] of patternMap) {
    if (data.occurrences.length < MIN_FREQUENCY) continue;

    const totalDuration = data.occurrences.reduce((sum, o) => sum + o.durationMs, 0);
    const successCount = data.occurrences.filter(o => o.success).length;

    patterns.push({
      name: generatePatternName(data.sequence),
      sequence: data.sequence,
      frequency: data.occurrences.length,
      avgDurationMs: Math.round(totalDuration / data.occurrences.length),
      successRate: Math.round((successCount / data.occurrences.length) * 100),
      examples: data.occurrences.slice(0, 3).map(o => ({
        sessionId: o.sessionId,
        timestamp: o.timestamp,
      })),
    });
  }

  // Sort by frequency descending
  patterns.sort((a, b) => b.frequency - a.frequency);

  return patterns;
}

// ============================================================================
// Tool Usage Statistics
// ============================================================================

export interface ToolUsageStat {
  tool: string;
  count: number;
  errorRate: number;
  avgDurationMs?: number;
}

/**
 * Calculate tool usage statistics from sessions
 */
export function calculateToolStats(sessions: SessionWithEvents[]): ToolUsageStat[] {
  const toolMap = new Map<string, { count: number; errors: number }>();

  for (const session of sessions) {
    for (const event of session.events) {
      if (!event.tool_name) continue;

      if (!toolMap.has(event.tool_name)) {
        toolMap.set(event.tool_name, { count: 0, errors: 0 });
      }

      const stats = toolMap.get(event.tool_name)!;
      stats.count++;

      if (hasErrorInOutput(event.tool_output)) {
        stats.errors++;
      }
    }
  }

  return Array.from(toolMap.entries())
    .map(([tool, stats]) => ({
      tool,
      count: stats.count,
      errorRate: Math.round((stats.errors / stats.count) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}
