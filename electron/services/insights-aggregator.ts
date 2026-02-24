/**
 * Insights Aggregator Service
 *
 * Aggregates patterns into actionable insights:
 * - Rule suggestions based on correction patterns
 * - Config health checks
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CorrectionPattern, WorkflowPattern } from './session-pattern-analyzer';
import { readSettings, readMcpConfig } from './config-manager';
import { getHooks } from './hook-manager';
import { getRules } from './rule-manager';

// ============================================================================
// Types
// ============================================================================

export interface RuleSuggestion {
  id: string;
  type: 'hook' | 'skill' | 'rule';
  name: string;
  reason: string;
  confidence: number; // 0-1
  template?: string;
  dismissed?: boolean;
}

export interface ConfigHealthIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  category: string;
  message: string;
  suggestion?: string;
  fixable?: boolean;
}

export interface ConfigHealth {
  score: number; // 0-100
  issues: ConfigHealthIssue[];
  lastChecked: string;
}

export interface InsightsSummary {
  corrections: {
    total: number;
    byType: Record<string, number>;
    recentCount: number;
  };
  workflows: {
    total: number;
    topPatterns: string[];
  };
  suggestions: {
    total: number;
    byType: Record<string, number>;
  };
  configHealth: ConfigHealth;
}

// ============================================================================
// Rule Suggestions
// ============================================================================

/**
 * Generate rule suggestions from correction patterns
 */
export function generateRuleSuggestions(patterns: CorrectionPattern[]): RuleSuggestion[] {
  const suggestions: RuleSuggestion[] = [];

  // Count correction types
  const typeCounts: Record<string, number> = {};
  const fileCounts: Record<string, number> = {};

  for (const pattern of patterns) {
    typeCounts[pattern.type] = (typeCounts[pattern.type] || 0) + 1;

    for (const file of pattern.filesAffected) {
      fileCounts[file] = (fileCounts[file] || 0) + 1;
    }
  }

  // Suggest pre-commit hook if many retry_command corrections
  if (typeCounts['retry_command'] && typeCounts['retry_command'] >= 3) {
    suggestions.push({
      id: 'suggest-precommit-hook',
      type: 'hook',
      name: 'Pre-commit Validation Hook',
      reason: `You retried commands ${typeCounts['retry_command']} times. A PreToolUse hook could validate commands before execution.`,
      confidence: Math.min(typeCounts['retry_command'] / 10, 0.9),
      template: `{
  "hooks": {
    "PreToolUse": [{
      "matcher": ["Bash"],
      "hooks": [{
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/validate-command.sh"
      }]
    }]
  }
}`,
    });
  }

  // Suggest file validation hook if many error_fix corrections
  if (typeCounts['error_fix'] && typeCounts['error_fix'] >= 3) {
    suggestions.push({
      id: 'suggest-edit-validation',
      type: 'hook',
      name: 'Edit Validation Hook',
      reason: `You fixed errors after edits ${typeCounts['error_fix']} times. A PostToolUse hook could run linting/type checks.`,
      confidence: Math.min(typeCounts['error_fix'] / 10, 0.85),
      template: `{
  "hooks": {
    "PostToolUse": [{
      "matcher": ["Edit", "Write"],
      "hooks": [{
        "type": "command",
        "command": "npm run lint --fix 2>/dev/null || true"
      }]
    }]
  }
}`,
    });
  }

  // Suggest rule for frequently corrected files
  const frequentFiles = Object.entries(fileCounts)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  if (frequentFiles.length > 0) {
    const [file, count] = frequentFiles[0];
    const ext = path.extname(file);

    suggestions.push({
      id: `suggest-rule-${ext.replace('.', '')}`,
      type: 'rule',
      name: `${ext} File Guidelines`,
      reason: `You corrected ${file} ${count} times. A rule could provide guidelines for ${ext} files.`,
      confidence: Math.min(count / 8, 0.75),
      template: `# ${ext.toUpperCase()} File Guidelines

When editing ${ext} files:
- Run type checks before committing
- Follow existing patterns in the codebase
- Verify imports are correct`,
    });
  }

  // Suggest quick-fix skill if many undo_edit corrections
  if (typeCounts['undo_edit'] && typeCounts['undo_edit'] >= 5) {
    suggestions.push({
      id: 'suggest-undo-skill',
      type: 'skill',
      name: 'Quick Undo Skill',
      reason: `You made quick edits ${typeCounts['undo_edit']} times. A skill could help with common undo patterns.`,
      confidence: Math.min(typeCounts['undo_edit'] / 15, 0.7),
    });
  }

  return suggestions;
}

/**
 * Generate suggestions from workflow patterns
 */
export function generateWorkflowSuggestions(workflows: WorkflowPattern[]): RuleSuggestion[] {
  const suggestions: RuleSuggestion[] = [];

  for (const workflow of workflows) {
    // Suggest hook for low success rate workflows
    if (workflow.successRate < 70 && workflow.frequency >= 5) {
      suggestions.push({
        id: `workflow-${workflow.sequence.join('-').toLowerCase()}`,
        type: 'hook',
        name: `${workflow.name} Validation`,
        reason: `"${workflow.name}" pattern has ${workflow.successRate}% success rate. Consider adding validation.`,
        confidence: Math.min((100 - workflow.successRate) / 100, 0.8),
      });
    }

    // Suggest skill for high-frequency workflows
    if (workflow.frequency >= 10 && workflow.sequence.length >= 3) {
      suggestions.push({
        id: `skill-${workflow.sequence.join('-').toLowerCase()}`,
        type: 'skill',
        name: `${workflow.name} Skill`,
        reason: `"${workflow.name}" is used ${workflow.frequency} times. Consider creating a skill to automate it.`,
        confidence: Math.min(workflow.frequency / 20, 0.75),
      });
    }
  }

  return suggestions;
}

// ============================================================================
// Config Health
// ============================================================================

/**
 * Check for common hook issues
 */
async function checkHookHealth(): Promise<ConfigHealthIssue[]> {
  const issues: ConfigHealthIssue[] = [];

  try {
    const hooks = await getHooks();

    // Check if any essential hooks are missing
    const eventTypes = new Set(hooks.map(h => h.eventType));

    if (!eventTypes.has('PreToolUse')) {
      issues.push({
        id: 'missing-pretooluse',
        severity: 'info',
        category: 'Hooks',
        message: 'No PreToolUse hooks configured',
        suggestion: 'Consider adding validation hooks for Write/Edit operations',
      });
    }

    if (!eventTypes.has('Stop')) {
      issues.push({
        id: 'missing-stop',
        severity: 'info',
        category: 'Hooks',
        message: 'No Stop hooks configured',
        suggestion: 'Stop hooks can notify you when sessions complete',
      });
    }

    // Check for disabled hooks
    const disabledHooks = hooks.filter(h => !h.enabled);
    if (disabledHooks.length > 0) {
      issues.push({
        id: 'disabled-hooks',
        severity: 'info',
        category: 'Hooks',
        message: `${disabledHooks.length} hook(s) are disabled`,
        suggestion: 'Review disabled hooks and remove if no longer needed',
      });
    }

    // Check for hooks with potential issues (command not found, etc.)
    for (const hook of hooks) {
      if (hook.command.includes('$CLAUDE_PROJECT_DIR')) {
        // Check if the hook file exists (assuming .claude/hooks/)
        // This is a heuristic check
        const hookPath = hook.command
          .replace('$CLAUDE_PROJECT_DIR', process.cwd())
          .split(' ')[0];

        if (hookPath.endsWith('.sh') || hookPath.endsWith('.ts')) {
          if (!fs.existsSync(hookPath)) {
            issues.push({
              id: `missing-hook-${hook.name}`,
              severity: 'warning',
              category: 'Hooks',
              message: `Hook "${hook.name}" references missing file: ${path.basename(hookPath)}`,
              suggestion: 'Create the hook script or remove the hook configuration',
            });
          }
        }
      }
    }
  } catch {
    // Ignore errors when checking hooks
  }

  return issues;
}

/**
 * Check MCP server configuration health
 */
async function checkMCPHealth(): Promise<ConfigHealthIssue[]> {
  const issues: ConfigHealthIssue[] = [];

  try {
    const config = readMcpConfig();
    const servers = config.mcpServers || {};

    const serverEntries = Object.entries(servers);

    if (serverEntries.length === 0) {
      issues.push({
        id: 'no-mcp-servers',
        severity: 'info',
        category: 'MCP',
        message: 'No MCP servers configured',
        suggestion: 'MCP servers extend Claude\'s capabilities with custom tools',
      });
      return issues;
    }

    // Check for disabled servers
    const disabledServers = serverEntries.filter(([, cfg]) => cfg.disabled);
    if (disabledServers.length > 0) {
      issues.push({
        id: 'disabled-mcp-servers',
        severity: 'info',
        category: 'MCP',
        message: `${disabledServers.length} MCP server(s) are disabled`,
        suggestion: 'Remove disabled servers if no longer needed',
      });
    }

    // Check for servers without explicit paths
    for (const [name, cfg] of serverEntries) {
      if (cfg.command === 'npx' || cfg.command === 'uvx') {
        // These are fine - package managers
        continue;
      }

      // Check if command exists in PATH
      if (!cfg.command.includes('/')) {
        // Relative command - could be OK or could fail
        issues.push({
          id: `mcp-relative-${name}`,
          severity: 'info',
          category: 'MCP',
          message: `MCP server "${name}" uses relative command: ${cfg.command}`,
          suggestion: 'Consider using absolute paths for reliability',
        });
      }
    }
  } catch {
    issues.push({
      id: 'mcp-config-error',
      severity: 'error',
      category: 'MCP',
      message: 'Could not read MCP configuration',
      suggestion: 'Check ~/.claude.json for syntax errors',
    });
  }

  return issues;
}

/**
 * Check rules configuration health
 */
async function checkRulesHealth(): Promise<ConfigHealthIssue[]> {
  const issues: ConfigHealthIssue[] = [];

  try {
    const rules = await getRules();

    if (rules.length === 0) {
      issues.push({
        id: 'no-rules',
        severity: 'info',
        category: 'Rules',
        message: 'No custom rules configured',
        suggestion: 'Rules help Claude follow your coding conventions',
      });
      return issues;
    }

    // Check for disabled rules
    const disabledRules = rules.filter(r => !r.enabled);
    if (disabledRules.length > 0) {
      issues.push({
        id: 'disabled-rules',
        severity: 'info',
        category: 'Rules',
        message: `${disabledRules.length} rule(s) are disabled`,
        suggestion: 'Remove disabled rules if no longer needed',
      });
    }

    // Check for very short rules (might not be useful)
    const shortRules = rules.filter(r => r.content.length < 50);
    if (shortRules.length > 0) {
      issues.push({
        id: 'short-rules',
        severity: 'info',
        category: 'Rules',
        message: `${shortRules.length} rule(s) are very short`,
        suggestion: 'Short rules may not provide enough guidance',
      });
    }
  } catch {
    // Ignore errors when checking rules
  }

  return issues;
}

/**
 * Check settings configuration health
 */
async function checkSettingsHealth(): Promise<ConfigHealthIssue[]> {
  const issues: ConfigHealthIssue[] = [];

  try {
    const settings = readSettings('global');

    // Check for ANTHROPIC_API_KEY in env (security issue)
    if (settings.env?.ANTHROPIC_API_KEY) {
      issues.push({
        id: 'api-key-in-settings',
        severity: 'warning',
        category: 'Security',
        message: 'API key is stored in settings file',
        suggestion: 'Use environment variables or keychain for API keys',
      });
    }

    // Check for very permissive allow rules
    if (settings.allow?.includes('*')) {
      issues.push({
        id: 'wildcard-allow',
        severity: 'warning',
        category: 'Permissions',
        message: 'Wildcard (*) in allow rules',
        suggestion: 'Consider using more specific allow patterns',
      });
    }
  } catch {
    // Ignore errors
  }

  return issues;
}

/**
 * Analyze overall config health
 */
export async function analyzeConfigHealth(): Promise<ConfigHealth> {
  const allIssues: ConfigHealthIssue[] = [];

  // Run all health checks
  const [hookIssues, mcpIssues, rulesIssues, settingsIssues] = await Promise.all([
    checkHookHealth(),
    checkMCPHealth(),
    checkRulesHealth(),
    checkSettingsHealth(),
  ]);

  allIssues.push(...hookIssues, ...mcpIssues, ...rulesIssues, ...settingsIssues);

  // Calculate score (100 - penalties)
  let score = 100;

  for (const issue of allIssues) {
    switch (issue.severity) {
      case 'error':
        score -= 15;
        break;
      case 'warning':
        score -= 8;
        break;
      case 'info':
        score -= 2;
        break;
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    issues: allIssues,
    lastChecked: new Date().toISOString(),
  };
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate a full insights summary
 */
export function generateInsightsSummary(
  corrections: CorrectionPattern[],
  workflows: WorkflowPattern[],
  suggestions: RuleSuggestion[],
  configHealth: ConfigHealth
): InsightsSummary {
  // Count corrections by type
  const byType: Record<string, number> = {};
  for (const c of corrections) {
    byType[c.type] = (byType[c.type] || 0) + 1;
  }

  // Count recent corrections (last 24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentCount = corrections.filter(
    c => new Date(c.timestamp).getTime() > oneDayAgo
  ).length;

  // Count suggestions by type
  const suggestionsByType: Record<string, number> = {};
  for (const s of suggestions) {
    suggestionsByType[s.type] = (suggestionsByType[s.type] || 0) + 1;
  }

  return {
    corrections: {
      total: corrections.length,
      byType,
      recentCount,
    },
    workflows: {
      total: workflows.length,
      topPatterns: workflows.slice(0, 5).map(w => w.name),
    },
    suggestions: {
      total: suggestions.length,
      byType: suggestionsByType,
    },
    configHealth,
  };
}
