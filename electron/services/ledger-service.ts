/**
 * Ledger Service
 *
 * Parses and updates CONTINUITY_CLAUDE-*.md ledger files.
 * Preserves file structure while allowing targeted updates to the State section.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ParsedLedger {
  goal: string;
  constraints: string[];
  keyDecisions: string[];
  state: {
    done: Array<{ phase: string; checked: boolean }>;
    now: string;
    next: string[];
  };
  openQuestions: string[];
  workingSet: Record<string, string>;
  raw: string;
}

export interface StateUpdate {
  currentPhase?: string;
  completedPhases?: string[];
  nextPhases?: string[];
}

export interface LedgerProgress {
  completed: number;
  total: number;
  percentage: number;
}

export type LedgerStatus = 'active' | 'stale' | 'completed';

export interface EnhancedLedgerData {
  projectName: string;
  progress: LedgerProgress;
  status: LedgerStatus;
  hasOpenQuestions: boolean;
}

/**
 * Parse a ledger file content into structured data
 */
export function parseLedger(content: string): ParsedLedger {
  const result: ParsedLedger = {
    goal: '',
    constraints: [],
    keyDecisions: [],
    state: {
      done: [],
      now: '',
      next: [],
    },
    openQuestions: [],
    workingSet: {},
    raw: content,
  };

  // Extract Goal section
  const goalMatch = content.match(/## Goal\n([\s\S]*?)(?=\n##|\n$)/);
  if (goalMatch) {
    result.goal = goalMatch[1].trim();
  }

  // Extract Constraints section
  const constraintsMatch = content.match(/## Constraints\n([\s\S]*?)(?=\n##|\n$)/);
  if (constraintsMatch) {
    result.constraints = constraintsMatch[1]
      .split('\n')
      .filter((line) => line.trim().startsWith('-'))
      .map((line) => line.replace(/^-\s*/, '').trim());
  }

  // Extract Key Decisions section
  const decisionsMatch = content.match(/## Key Decisions\n([\s\S]*?)(?=\n##|\n$)/);
  if (decisionsMatch) {
    result.keyDecisions = decisionsMatch[1]
      .split('\n')
      .filter((line) => line.trim().startsWith('-'))
      .map((line) => line.replace(/^-\s*/, '').trim());
  }

  // Extract State section
  const stateMatch = content.match(/## State\n([\s\S]*?)(?=\n##|\n$)/);
  if (stateMatch) {
    const stateContent = stateMatch[1];

    // Parse Done items (with checkboxes)
    const doneMatch = stateContent.match(/- Done:\n([\s\S]*?)(?=- Now:|- Next:|$)/);
    if (doneMatch) {
      const doneLines = doneMatch[1].split('\n').filter((line) => line.trim().startsWith('-'));
      for (const line of doneLines) {
        const checkMatch = line.match(/- \[(x| )\]\s*(.+)/);
        if (checkMatch) {
          result.state.done.push({
            phase: checkMatch[2].trim(),
            checked: checkMatch[1] === 'x',
          });
        }
      }
    }

    // Parse Now (current phase)
    const nowMatch = stateContent.match(/- Now:\s*\[?[→\s]?\]?\s*(.+)/);
    if (nowMatch) {
      result.state.now = nowMatch[1].trim();
    }

    // Parse Next items
    const nextMatch = stateContent.match(/- Next:\n([\s\S]*?)(?=- Remaining:|$)/);
    if (nextMatch) {
      const nextLines = nextMatch[1].split('\n').filter((line) => line.trim().startsWith('-'));
      for (const line of nextLines) {
        const phaseMatch = line.match(/- \[[ x]?\]\s*(.+)/);
        if (phaseMatch) {
          result.state.next.push(phaseMatch[1].trim());
        } else {
          const simpleMatch = line.match(/- (.+)/);
          if (simpleMatch) {
            result.state.next.push(simpleMatch[1].trim());
          }
        }
      }
    }
  }

  // Extract Open Questions section
  const questionsMatch = content.match(/## Open Questions\n([\s\S]*?)(?=\n##|\n$)/);
  if (questionsMatch) {
    result.openQuestions = questionsMatch[1]
      .split('\n')
      .filter((line) => line.trim().startsWith('-'))
      .map((line) => line.replace(/^-\s*/, '').trim());
  }

  // Extract Working Set section
  const workingSetMatch = content.match(/## Working Set\n([\s\S]*?)(?=\n##|\n$)/);
  if (workingSetMatch) {
    const lines = workingSetMatch[1].split('\n');
    for (const line of lines) {
      const kvMatch = line.match(/^\s*-\s*\*\*(.+?)\*\*:\s*(.+)/);
      if (kvMatch) {
        result.workingSet[kvMatch[1]] = kvMatch[2].trim();
      }
    }
  }

  return result;
}

/**
 * Update the State section of a ledger file
 *
 * This function modifies the ledger content to:
 * - Mark phases as completed (checked)
 * - Update the current "Now" phase
 * - Preserve all other content
 */
export function updateLedgerState(content: string, updates: StateUpdate): string {
  let newContent = content;

  // Update completed phases
  if (updates.completedPhases && updates.completedPhases.length > 0) {
    for (const phase of updates.completedPhases) {
      // Match both checked and unchecked checkboxes for this phase
      const escapedPhase = phase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const uncheckedPattern = new RegExp(`(- \\[) \\](\\s*${escapedPhase})`, 'g');
      newContent = newContent.replace(uncheckedPattern, '$1x]$2');
    }
  }

  // Update current phase (Now line)
  if (updates.currentPhase) {
    // Replace the Now: line with the new current phase
    const nowPattern = /- Now:\s*\[?[→\s]?\]?\s*.+/;
    newContent = newContent.replace(
      nowPattern,
      `- Now: [→] ${updates.currentPhase}`
    );
  }

  // Update timestamp
  const timestampPattern = /Updated:\s*[\d\-T:.Z]+/;
  if (timestampPattern.test(newContent)) {
    newContent = newContent.replace(
      timestampPattern,
      `Updated: ${new Date().toISOString()}`
    );
  }

  return newContent;
}

/**
 * Validate that a path is a valid ledger path
 */
export function isValidLedgerPath(ledgerPath: string): boolean {
  const workspaceDir = path.join(os.homedir(), 'workspace');
  const normalizedPath = path.normalize(ledgerPath);

  return (
    normalizedPath.startsWith(workspaceDir) &&
    normalizedPath.includes('thoughts/ledgers/') &&
    normalizedPath.endsWith('.md')
  );
}

/**
 * Write content to a ledger file with atomic rename
 */
export function writeLedger(ledgerPath: string, content: string): void {
  if (!isValidLedgerPath(ledgerPath)) {
    throw new Error('Invalid ledger path');
  }

  // Write to temp file first for atomic update
  const tempPath = `${ledgerPath}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf-8');

  // Atomic rename
  fs.renameSync(tempPath, ledgerPath);
}

/**
 * Read a ledger file
 */
export function readLedger(ledgerPath: string): string {
  if (!isValidLedgerPath(ledgerPath)) {
    throw new Error('Invalid ledger path');
  }

  return fs.readFileSync(ledgerPath, 'utf-8');
}

/**
 * Calculate progress from parsed ledger
 */
export function calculateProgress(parsed: ParsedLedger): LedgerProgress {
  // Count phases: done items, current (now), and next items
  const donePhases = parsed.state.done;
  const hasNow = parsed.state.now && parsed.state.now.length > 0;
  const nextPhases = parsed.state.next;

  // Total = all done phases + 1 if there's a current + remaining next phases
  const total = donePhases.length + (hasNow ? 1 : 0) + nextPhases.length;

  // Completed = checked phases from done list
  const completed = donePhases.filter((p) => p.checked).length;

  if (total === 0) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  const percentage = Math.round((completed / total) * 100);

  return { completed, total, percentage };
}

/**
 * Calculate status from parsed ledger and last modified date
 * - completed: all phases checked and no "now" or "next"
 * - stale: no updates in 7+ days
 * - active: everything else
 */
export function calculateStatus(
  parsed: ParsedLedger,
  lastModified: string
): LedgerStatus {
  const progress = calculateProgress(parsed);

  // All phases completed, nothing left to do
  if (
    progress.total > 0 &&
    progress.completed === progress.total &&
    !parsed.state.now &&
    parsed.state.next.length === 0
  ) {
    return 'completed';
  }

  // Check if stale (7+ days without updates)
  const lastModDate = new Date(lastModified);
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - lastModDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate > 7) {
    return 'stale';
  }

  return 'active';
}

/**
 * Get enhanced ledger data from content and metadata
 */
export function getEnhancedLedgerData(
  content: string,
  projectPath: string,
  lastModified: string
): EnhancedLedgerData {
  const parsed = parseLedger(content);
  const progress = calculateProgress(parsed);
  const status = calculateStatus(parsed, lastModified);

  // Extract project name from path
  const projectName = path.basename(projectPath);

  // Check for open questions
  const hasOpenQuestions =
    parsed.openQuestions.length > 0 &&
    parsed.openQuestions.some((q) => q.trim().length > 0);

  return {
    projectName,
    progress,
    status,
    hasOpenQuestions,
  };
}
