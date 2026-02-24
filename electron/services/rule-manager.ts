/**
 * Rule Manager Service for Claude Session Manager
 *
 * Manages Claude Code rules:
 * - Scan ~/.claude/rules/ and {projectPath}/.claude/rules/
 * - Parse .md files for rule content
 * - Check for .disabled extension for enabled/disabled state
 * - Toggle rules by renaming files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================
// Types
// ============================================================

export interface RuleInfo {
  name: string;
  filename: string;
  source: 'global' | 'project';
  path: string;
  content: string;
  enabled: boolean; // .disabled extension means disabled
  description?: string; // First paragraph or frontmatter description
  globs?: string[]; // From frontmatter
}

// ============================================================
// Rule Discovery
// ============================================================

/**
 * Get all rules from global and project directories
 * @param projectPath - Optional project path to include project-specific rules
 * @returns Array of RuleInfo objects
 */
export function getRules(projectPath?: string): RuleInfo[] {
  const rules: RuleInfo[] = [];

  // Get global rules from ~/.claude/rules/
  const globalRulesDir = path.join(os.homedir(), '.claude', 'rules');
  if (fs.existsSync(globalRulesDir)) {
    scanRulesDirectory(globalRulesDir, 'global', rules);
  }

  // Get project rules if path provided
  if (projectPath) {
    const projectRulesDir = path.join(projectPath, '.claude', 'rules');
    if (fs.existsSync(projectRulesDir)) {
      scanRulesDirectory(projectRulesDir, 'project', rules);
    }
  }

  // Sort by name, keeping enabled first
  rules.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return rules;
}

/**
 * Scan a rules directory for .md files
 */
function scanRulesDirectory(
  directory: string,
  source: 'global' | 'project',
  rules: RuleInfo[]
): void {
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const filename = entry.name;

      // Check for .md or .md.disabled files
      const isDisabled = filename.endsWith('.md.disabled');
      const isMd = filename.endsWith('.md') && !isDisabled;

      if (!isMd && !isDisabled) continue;

      // Skip .DS_Store and other dotfiles
      if (filename.startsWith('.')) continue;

      const filePath = path.join(directory, filename);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { name, description, globs } = parseRuleMd(content, filename);

        rules.push({
          name,
          filename,
          source,
          path: filePath,
          content,
          enabled: !isDisabled,
          description,
          globs,
        });
      } catch (error) {
        console.warn(`[RuleManager] Error reading ${filePath}:`, error);
      }
    }
  } catch (error) {
    console.error('[RuleManager] Error scanning rules directory:', error);
  }
}

/**
 * Parse rule markdown content for metadata
 */
function parseRuleMd(
  content: string,
  filename: string
): {
  name: string;
  description?: string;
  globs?: string[];
} {
  // Extract name from filename (remove .md or .md.disabled)
  let name = filename.replace(/\.md(\.disabled)?$/, '');

  // Convert kebab-case to Title Case
  name = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  let description: string | undefined;
  let globs: string[] | undefined;

  // Check for YAML frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];

    // Parse globs
    const globsMatch = frontmatter.match(/^globs:\s*\[(.*)\]\s*$/m);
    if (globsMatch) {
      globs = globsMatch[1]
        .split(',')
        .map((g) => g.trim().replace(/["']/g, ''))
        .filter(Boolean);
    }

    // Check for description in frontmatter
    const descMatch = frontmatter.match(/^description:\s*["']?([^"'\n]+)["']?\s*$/m);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }

  // If no description in frontmatter, try to extract from content
  if (!description) {
    // Look for first paragraph after frontmatter and heading
    const contentAfterFrontmatter = frontmatterMatch
      ? content.slice(frontmatterMatch[0].length)
      : content;

    // Skip any initial heading
    const withoutHeading = contentAfterFrontmatter.replace(/^#[^#\n][^\n]*\n+/, '');

    // Get first paragraph (not starting with #, -, *, or whitespace-only lines)
    const lines = withoutHeading.split('\n');
    const paragraphLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (paragraphLines.length > 0) break;
        continue;
      }
      if (trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        break;
      }
      paragraphLines.push(trimmed);
    }

    if (paragraphLines.length > 0) {
      description = paragraphLines.join(' ').substring(0, 200);
    }
  }

  return { name, description, globs };
}

// ============================================================
// Rule Content Reading
// ============================================================

/**
 * Read the full content of a rule file
 * @param rulePath - Path to the rule file
 * @returns The rule content
 */
export function getRuleContent(rulePath: string): string {
  try {
    if (!fs.existsSync(rulePath)) {
      return `// Rule file not found: ${rulePath}`;
    }

    return fs.readFileSync(rulePath, 'utf-8');
  } catch (error) {
    console.error('[RuleManager] Error reading rule content:', error);
    return `// Error reading rule: ${error}`;
  }
}

// ============================================================
// Rule Management
// ============================================================

/**
 * Toggle a rule's enabled state by renaming the file
 * @param rulePath - Path to the rule file
 * @param enabled - Whether to enable or disable the rule
 * @returns Success status and optional error
 */
export function toggleRule(
  rulePath: string,
  enabled: boolean
): { success: boolean; error?: string; newPath?: string } {
  try {
    if (!fs.existsSync(rulePath)) {
      return { success: false, error: 'Rule file not found' };
    }

    const isCurrentlyDisabled = rulePath.endsWith('.md.disabled');

    if (enabled && isCurrentlyDisabled) {
      // Enable: remove .disabled extension
      const newPath = rulePath.replace(/\.disabled$/, '');
      fs.renameSync(rulePath, newPath);
      return { success: true, newPath };
    } else if (!enabled && !isCurrentlyDisabled) {
      // Disable: add .disabled extension
      const newPath = `${rulePath}.disabled`;
      fs.renameSync(rulePath, newPath);
      return { success: true, newPath };
    }

    // Already in the desired state
    return { success: true, newPath: rulePath };
  } catch (error) {
    console.error('[RuleManager] Error toggling rule:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================
// Rule Creation (optional helper)
// ============================================================

/**
 * Create a new rule file
 * @param name - Name for the rule (will be converted to kebab-case)
 * @param content - Rule content
 * @param scope - 'global' or 'project'
 * @param projectPath - Required when scope is 'project'
 * @returns Success status and the created file path
 */
export function createRule(
  name: string,
  content: string,
  scope: 'global' | 'project',
  projectPath?: string
): { success: boolean; path?: string; error?: string } {
  try {
    // Convert name to kebab-case
    const filename =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '.md';

    // Determine directory
    const baseDir =
      scope === 'global'
        ? path.join(os.homedir(), '.claude', 'rules')
        : path.join(projectPath || '', '.claude', 'rules');

    // Ensure directory exists
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    const filePath = path.join(baseDir, filename);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return { success: false, error: 'Rule already exists' };
    }

    // Write the file
    fs.writeFileSync(filePath, content, 'utf-8');

    return { success: true, path: filePath };
  } catch (error) {
    console.error('[RuleManager] Error creating rule:', error);
    return { success: false, error: String(error) };
  }
}
