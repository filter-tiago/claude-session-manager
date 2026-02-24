/**
 * Handoff Service
 *
 * Generates handoff documents from session state for context transfer
 * between sessions or for documentation purposes.
 */

import fs from 'fs';
import path from 'path';
import type { Session, SessionEvent } from '../../src/types/electron';

export interface HandoffOptions {
  includeRecentMessages?: number; // How many recent assistant messages to include
  includeFilesTouched?: boolean;
  includeLedgerContext?: boolean;
}

interface ParsedLedger {
  goal?: string;
  currentPhase?: string;
  openQuestions?: string[];
}

/**
 * Generate a handoff document from session state
 */
export function generateHandoff(
  session: Session,
  events: SessionEvent[],
  ledger?: ParsedLedger,
  options: HandoffOptions = {}
): string {
  const {
    includeRecentMessages = 5,
    includeFilesTouched = true,
    includeLedgerContext = true,
  } = options;

  const now = new Date();
  const timestamp = now.toISOString();
  const humanDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Build YAML frontmatter
  const frontmatter = [
    '---',
    `date: ${timestamp}`,
    `session_id: ${session.session_id}`,
    `session_name: ${session.name || session.project_name}`,
    `project: ${session.project_name}`,
    `branch: ${session.git_branch || 'unknown'}`,
    `status: ${session.status}`,
    '---',
  ].join('\n');

  // Build header
  const header = [
    `# Handoff: ${session.name || session.detected_task || session.project_name}`,
    '',
    `> Generated on ${humanDate}`,
    '',
  ].join('\n');

  // Build summary section
  const summary = [
    '## Summary',
    '',
    session.detected_task
      ? `**Current Task:** ${session.detected_task}`
      : '*No task detected*',
    '',
    session.detected_activity
      ? `**Activity:** ${session.detected_activity}`
      : '',
    '',
    `**Session Status:** ${session.status}`,
    `**Messages:** ${session.message_count}`,
    `**Tool Calls:** ${session.tool_call_count}`,
    '',
  ].filter(Boolean).join('\n');

  // Build recent activity section
  const recentMessages = events
    .filter((e) => e.event_type === 'assistant')
    .slice(-includeRecentMessages)
    .map((e) => {
      const content = e.content || '';
      // Truncate long messages
      const truncated = content.length > 500
        ? content.substring(0, 500) + '...'
        : content;
      return `- ${truncated.replace(/\n/g, ' ').trim()}`;
    });

  const recentActivity = [
    '## Recent Activity',
    '',
    recentMessages.length > 0
      ? recentMessages.join('\n\n')
      : '*No recent assistant messages*',
    '',
  ].join('\n');

  // Build files touched section
  let filesTouched = '';
  if (includeFilesTouched) {
    const files = new Set<string>();
    for (const event of events) {
      if (event.files_touched) {
        try {
          const touched = JSON.parse(event.files_touched);
          if (Array.isArray(touched)) {
            touched.forEach((f) => files.add(f));
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    if (files.size > 0) {
      filesTouched = [
        '## Files Modified',
        '',
        Array.from(files).map((f) => `- \`${f}\``).join('\n'),
        '',
      ].join('\n');
    }
  }

  // Build ledger context section
  let ledgerContext = '';
  if (includeLedgerContext && ledger) {
    const parts = ['## Ledger Context', ''];

    if (ledger.goal) {
      parts.push(`**Goal:** ${ledger.goal}`);
      parts.push('');
    }

    if (ledger.currentPhase) {
      parts.push(`**Current Phase:** ${ledger.currentPhase}`);
      parts.push('');
    }

    if (ledger.openQuestions && ledger.openQuestions.length > 0) {
      parts.push('**Open Questions:**');
      for (const q of ledger.openQuestions) {
        parts.push(`- ${q}`);
      }
      parts.push('');
    }

    if (parts.length > 2) {
      ledgerContext = parts.join('\n');
    }
  }

  // Build action items section (placeholder for user to fill in)
  const actionItems = [
    '## Action Items',
    '',
    '<!-- Add action items for the next session -->',
    '- [ ] ',
    '',
  ].join('\n');

  // Build next steps section
  const nextSteps = [
    '## Next Steps',
    '',
    '<!-- Describe what needs to happen next -->',
    '',
  ].join('\n');

  // Combine all sections
  const sections = [
    frontmatter,
    '',
    header,
    summary,
    recentActivity,
    filesTouched,
    ledgerContext,
    actionItems,
    nextSteps,
  ].filter(Boolean);

  return sections.join('\n');
}

/**
 * Generate a handoff filename based on session info
 */
export function generateHandoffFilename(session: Session): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toISOString().split('T')[1].substring(0, 5).replace(':', ''); // HHMM

  // Create a slug from the task or session name
  let description = session.detected_task || session.name || 'session';
  description = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);

  return `${dateStr}_${timeStr}_${description}.md`;
}

/**
 * Get or create the handoffs directory for a session
 */
export function getHandoffsDirectory(session: Session): string {
  // Use session name or project name for directory
  const sessionSlug = (session.name || session.session_id.substring(0, 8))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

  const handoffsDir = path.join(
    session.project_path,
    'thoughts',
    'handoffs',
    sessionSlug
  );

  // Create directory if it doesn't exist
  if (!fs.existsSync(handoffsDir)) {
    fs.mkdirSync(handoffsDir, { recursive: true });
  }

  return handoffsDir;
}

/**
 * Save a handoff document to disk
 */
export function saveHandoff(
  session: Session,
  content: string
): { success: boolean; path: string; error?: string } {
  try {
    const dir = getHandoffsDirectory(session);
    const filename = generateHandoffFilename(session);
    const filePath = path.join(dir, filename);

    fs.writeFileSync(filePath, content, 'utf-8');

    return { success: true, path: filePath };
  } catch (error) {
    return {
      success: false,
      path: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
