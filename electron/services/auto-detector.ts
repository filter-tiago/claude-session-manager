/**
 * Auto-Detector for Claude Session Manager
 *
 * Enhanced detection of session properties:
 * - Task: What the user is trying to accomplish
 * - Activity: Current mode (planning, implementing, debugging, etc.)
 * - Area: Project area or domain
 * - Ledger: Associated continuity ledger
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSessions, updateSessionDetectedFields } from './database';
import type { Session, SessionEvent } from '../../src/types/electron';

// ============================================================
// Task Detection
// ============================================================

/**
 * Extract a concise task description from the first user message
 */
export function detectTaskEnhanced(message: string): string {
  // Clean up the message
  let task = message
    .replace(/^#+\s*/gm, '') // Remove markdown headers
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/<[^>]+>/g, '') // Remove HTML/XML tags
    .replace(/\n+/g, ' ') // Normalize newlines
    .trim();

  // Look for common task prefixes
  const taskPatterns = [
    /(?:please\s+)?(?:help\s+(?:me\s+)?)?(?:to\s+)?([a-z]+\s+[^.!?]+)/i,
    /(?:I\s+(?:want|need)\s+(?:to|you\s+to)\s+)([^.!?]+)/i,
    /(?:Can\s+you\s+)([^.!?]+)/i,
    /(?:implement|create|build|fix|update|add|remove|refactor|test|debug)\s+([^.!?]+)/i,
  ];

  for (const pattern of taskPatterns) {
    const match = task.match(pattern);
    if (match) {
      task = match[1] || match[0];
      break;
    }
  }

  // Take first sentence or first 200 chars
  const firstSentence = task.match(/^[^.!?]+[.!?]/);
  if (firstSentence) {
    task = firstSentence[0];
  }

  // Capitalize first letter
  task = task.charAt(0).toUpperCase() + task.slice(1);

  return task.substring(0, 200);
}

/**
 * Detect if message refers to a specific skill/command
 */
export function detectSkillReference(message: string): string | null {
  // Look for /skill references
  const skillMatch = message.match(/\/([a-z\-]+)/i);
  if (skillMatch) {
    return skillMatch[1];
  }
  return null;
}

// ============================================================
// Activity Detection
// ============================================================

export type ActivityType =
  | 'planning'
  | 'implementing'
  | 'editing'
  | 'debugging'
  | 'testing'
  | 'exploring'
  | 'committing'
  | 'documenting'
  | 'chatting'
  | 'reviewing';

/**
 * Detect activity type from tool usage patterns
 */
export function detectActivityEnhanced(toolNames: Set<string>, permissionMode?: string): ActivityType {
  const hasEdit = toolNames.has('Edit') || toolNames.has('Write');
  const hasRead = toolNames.has('Read') || toolNames.has('Grep') || toolNames.has('Glob');
  const hasBash = toolNames.has('Bash');
  const hasGit = Array.from(toolNames).some((t) =>
    t.toLowerCase().includes('git') || t === 'Bash'
  );
  const hasTask = toolNames.has('Task');
  const hasNotebook = toolNames.has('NotebookEdit');

  // Check permission mode
  if (permissionMode === 'plan') {
    return 'planning';
  }

  // Prioritize based on tool combinations
  if (hasGit && hasEdit) return 'committing';
  if (hasTask) return 'implementing';
  if (hasNotebook) return 'exploring';
  if (hasEdit && hasBash) return 'implementing';
  if (hasEdit && !hasBash && !hasRead) return 'editing';
  if (hasRead && !hasEdit) return 'exploring';
  if (hasBash && !hasRead && !hasEdit) return 'testing';

  return 'chatting';
}

/**
 * More detailed activity detection from events
 */
export function detectActivityFromEvents(events: SessionEvent[]): ActivityType {
  const recentTools = new Set<string>();
  const recentContent: string[] = [];

  // Look at last 20 events
  const recent = events.slice(-20);

  for (const event of recent) {
    if (event.tool_name) {
      recentTools.add(event.tool_name);
    }
    if (event.content) {
      recentContent.push(event.content.toLowerCase());
    }
  }

  // Check content for debugging signals
  const contentStr = recentContent.join(' ');
  if (
    contentStr.includes('error') ||
    contentStr.includes('debug') ||
    contentStr.includes('fix') ||
    contentStr.includes('issue')
  ) {
    return 'debugging';
  }

  if (contentStr.includes('test') || contentStr.includes('spec')) {
    return 'testing';
  }

  if (contentStr.includes('document') || contentStr.includes('readme')) {
    return 'documenting';
  }

  if (contentStr.includes('review') || contentStr.includes('pr ')) {
    return 'reviewing';
  }

  return detectActivityEnhanced(recentTools);
}

// ============================================================
// Area Detection
// ============================================================

// Directories to always skip when detecting areas
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '__pycache__', '.git', '.next',
  'coverage', 'out', '.turbo', '.cache', 'target', 'vendor',
  'bower_components', '.venv', 'env', 'venv', '__tests__', 'tests',
  'test', 'spec', 'docs', 'doc', 'public', 'static', 'assets',
]);

// Priority-weighted patterns for area detection
const AREA_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  // Priority 1: Explicit area markers (highest weight)
  { pattern: /areas\/([^/]+)/, weight: 10 },
  { pattern: /domains\/([^/]+)/, weight: 10 },
  { pattern: /modules\/([^/]+)/, weight: 10 },
  { pattern: /features\/([^/]+)/, weight: 10 },

  // Priority 2: Monorepo patterns (high weight)
  { pattern: /packages\/([^/]+)/, weight: 8 },
  { pattern: /apps\/([^/]+)/, weight: 8 },
  { pattern: /services\/([^/]+)/, weight: 8 },
  { pattern: /libs\/([^/]+)/, weight: 8 },
  { pattern: /internal\/([^/]+)/, weight: 8 },

  // Priority 3: Generic patterns (lower weight)
  { pattern: /src\/([^/]+)/, weight: 3 },
  { pattern: /app\/([^/]+)/, weight: 3 },
  { pattern: /lib\/([^/]+)/, weight: 3 },
  { pattern: /components\/([^/]+)/, weight: 3 },

  // Priority 4: Workspace root (lowest weight)
  { pattern: /workspace\/[^/]+\/([^/]+)/, weight: 1 },
];

/**
 * Detect area/domain from file paths with prioritized heuristics
 */
export function detectArea(filesTouched: Set<string>): string | undefined {
  const areaScores: Record<string, number> = {};

  for (const filePath of filesTouched) {
    for (const { pattern, weight } of AREA_PATTERNS) {
      const match = filePath.match(pattern);
      if (match) {
        const area = match[1];
        // Skip common non-area directories
        if (!SKIP_DIRS.has(area.toLowerCase())) {
          areaScores[area] = (areaScores[area] || 0) + weight;
        }
      }
    }
  }

  // Return highest-scoring area
  let maxScore = 0;
  let maxArea: string | undefined;

  for (const [area, score] of Object.entries(areaScores)) {
    if (score > maxScore) {
      maxScore = score;
      maxArea = area;
    }
  }

  return maxArea;
}

/**
 * Detect area from project path
 */
export function detectAreaFromProjectPath(projectPath: string): string | undefined {
  // Extract meaningful name from project path
  const parts = projectPath.split('/').filter((p) => p && !p.startsWith('.'));
  const projectName = parts[parts.length - 1];

  // Common patterns
  const patterns = [
    { pattern: /backend|api|server/i, area: 'Backend' },
    { pattern: /frontend|ui|client|web/i, area: 'Frontend' },
    { pattern: /mobile|ios|android/i, area: 'Mobile' },
    { pattern: /infra|deploy|devops|ci/i, area: 'Infrastructure' },
    { pattern: /test|spec/i, area: 'Testing' },
    { pattern: /doc|docs|documentation/i, area: 'Documentation' },
  ];

  for (const { pattern, area } of patterns) {
    if (pattern.test(projectName)) {
      return area;
    }
  }

  return projectName;
}

// ============================================================
// Ledger Detection
// ============================================================

/**
 * Detect ledger reference from session content
 */
export function detectLedgerReference(content: string): string | null {
  // Look for CONTINUITY_CLAUDE pattern
  const ledgerMatch = content.match(/CONTINUITY_CLAUDE[-\w]+/);
  if (ledgerMatch) {
    return ledgerMatch[0];
  }

  // Look for /resume command
  const resumeMatch = content.match(/\/resume\s+([^\s]+)/i);
  if (resumeMatch) {
    return resumeMatch[1];
  }

  return null;
}

/**
 * Find ledger file in project directory
 */
export function findProjectLedger(projectPath: string): string | null {
  const ledgerDir = path.join(projectPath, 'thoughts', 'ledgers');

  try {
    if (fs.existsSync(ledgerDir)) {
      const files = fs.readdirSync(ledgerDir);
      const ledgers = files.filter((f) => f.startsWith('CONTINUITY_CLAUDE'));

      if (ledgers.length > 0) {
        // Return most recently modified
        const sorted = ledgers
          .map((f) => ({
            name: f,
            mtime: fs.statSync(path.join(ledgerDir, f)).mtime,
          }))
          .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

        return sorted[0].name;
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return null;
}

// ============================================================
// Session Enhancement
// ============================================================

/**
 * Enhance session with auto-detected properties
 */
export function enhanceSession(
  session: Session,
  events: SessionEvent[]
): Partial<Session> {
  const enhancements: Partial<Session> = {};

  // Detect task if not already set
  if (!session.detected_task && events.length > 0) {
    const firstUserEvent = events.find((e) => e.event_type === 'user');
    if (firstUserEvent?.content) {
      enhancements.detected_task = detectTaskEnhanced(firstUserEvent.content);
    }
  }

  // Detect activity from recent events
  enhancements.detected_activity = detectActivityFromEvents(events);

  // Detect area from files touched
  const filesTouched = new Set<string>();
  for (const event of events) {
    if (event.files_touched) {
      for (const file of event.files_touched.split(',')) {
        filesTouched.add(file.trim());
      }
    }
  }

  if (filesTouched.size > 0) {
    enhancements.detected_area = detectArea(filesTouched);
  }

  // Fallback to project path
  if (!enhancements.detected_area) {
    enhancements.detected_area = detectAreaFromProjectPath(session.project_path);
  }

  // Detect ledger reference
  if (!session.ledger_link) {
    for (const event of events) {
      if (event.content) {
        const ledger = detectLedgerReference(event.content);
        if (ledger) {
          enhancements.ledger_link = ledger;
          break;
        }
      }
    }

    // Try to find ledger in project
    if (!enhancements.ledger_link) {
      const projectLedger = findProjectLedger(session.project_path);
      if (projectLedger) {
        enhancements.ledger_link = projectLedger;
      }
    }
  }

  return enhancements;
}

/**
 * Run auto-detection on all sessions without detected properties
 */
export async function runAutoDetection(): Promise<number> {
  const sessions = getSessions();
  let enhanced = 0;

  for (const session of sessions) {
    // Skip sessions with all properties already set
    if (
      session.detected_task &&
      session.detected_activity &&
      session.detected_area
    ) {
      continue;
    }

    // We need events to enhance, but for now just update basic detections
    if (!session.detected_area) {
      const area = detectAreaFromProjectPath(session.project_path);
      if (area) {
        updateSessionDetectedFields(session.session_id, area, undefined, undefined);
        enhanced++;
      }
    }
  }

  return enhanced;
}

