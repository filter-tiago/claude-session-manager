/**
 * Skill Manager Service for Claude Session Manager
 *
 * Manages Claude Code skills:
 * - Scan ~/.claude/skills/ and {projectPath}/.claude/skills/
 * - Parse SKILL.md files for name/description
 * - Load triggers from skill-rules.json if exists
 * - Test if prompts would trigger skills
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================
// Types
// ============================================================

export interface SkillInfo {
  name: string;
  description: string;
  source: 'global' | 'project';
  path: string;
  content: string; // SKILL.md content
  triggers?: string[]; // From skill-rules.json or frontmatter
  allowedTools?: string[]; // From frontmatter
}

interface SkillRulesEntry {
  skill: string;
  triggers?: string[];
  patterns?: string[];
}

// ============================================================
// Skill Discovery
// ============================================================

/**
 * Get all skills from global and project directories
 * @param projectPath - Optional project path to include project-specific skills
 * @returns Array of SkillInfo objects
 */
export function getSkills(projectPath?: string): SkillInfo[] {
  const skills: SkillInfo[] = [];

  // Get global skills from ~/.claude/skills/
  const globalSkillsDir = path.join(os.homedir(), '.claude', 'skills');
  if (fs.existsSync(globalSkillsDir)) {
    scanSkillsDirectory(globalSkillsDir, 'global', skills);
  }

  // Get project skills if path provided
  if (projectPath) {
    const projectSkillsDir = path.join(projectPath, '.claude', 'skills');
    if (fs.existsSync(projectSkillsDir)) {
      scanSkillsDirectory(projectSkillsDir, 'project', skills);
    }
  }

  // Load triggers from skill-rules.json
  loadSkillTriggers(skills, projectPath);

  // Sort by name
  skills.sort((a, b) => a.name.localeCompare(b.name));

  return skills;
}

/**
 * Scan a skills directory for SKILL.md files
 */
function scanSkillsDirectory(
  directory: string,
  source: 'global' | 'project',
  skills: SkillInfo[]
): void {
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const skillDir = path.join(directory, entry.name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      if (fs.existsSync(skillMdPath)) {
        try {
          const content = fs.readFileSync(skillMdPath, 'utf-8');
          const { name, description, allowedTools, triggers } = parseSkillMd(content, entry.name);

          skills.push({
            name,
            description,
            source,
            path: skillDir,
            content,
            allowedTools,
            triggers,
          });
        } catch (error) {
          console.warn(`[SkillManager] Error reading ${skillMdPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[SkillManager] Error scanning skills directory:', error);
  }
}

/**
 * Parse SKILL.md content for metadata
 */
function parseSkillMd(
  content: string,
  folderName: string
): {
  name: string;
  description: string;
  allowedTools?: string[];
  triggers?: string[];
} {
  let name = folderName;
  let description = '';
  let allowedTools: string[] | undefined;
  let triggers: string[] | undefined;

  // Check for YAML frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];

    // Parse name
    const nameMatch = frontmatter.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    // Parse description
    const descMatch = frontmatter.match(/^description:\s*["']?([^"'\n]+)["']?\s*$/m);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    // Parse allowed-tools
    const toolsMatch = frontmatter.match(/^allowed-tools:\s*\[(.*)\]\s*$/m);
    if (toolsMatch) {
      allowedTools = toolsMatch[1]
        .split(',')
        .map((t) => t.trim().replace(/["']/g, ''))
        .filter(Boolean);
    }

    // Parse triggers (if in frontmatter)
    const triggersMatch = frontmatter.match(/^triggers:\s*\[(.*)\]\s*$/m);
    if (triggersMatch) {
      triggers = triggersMatch[1]
        .split(',')
        .map((t) => t.trim().replace(/["']/g, ''))
        .filter(Boolean);
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

    // Get first paragraph
    const firstParagraph = withoutHeading.match(/^([^\n#]+)/);
    if (firstParagraph) {
      description = firstParagraph[1].trim().substring(0, 200);
    }
  }

  return { name, description, allowedTools, triggers };
}

/**
 * Load triggers from skill-rules.json files
 */
function loadSkillTriggers(skills: SkillInfo[], projectPath?: string): void {
  // Try global skill-rules.json
  const globalRulesPath = path.join(os.homedir(), '.claude', 'skill-rules.json');
  loadSkillRulesFromFile(globalRulesPath, skills);

  // Try project skill-rules.json
  if (projectPath) {
    const projectRulesPath = path.join(projectPath, '.claude', 'skill-rules.json');
    loadSkillRulesFromFile(projectRulesPath, skills);
  }
}

/**
 * Load triggers from a specific skill-rules.json file
 */
function loadSkillRulesFromFile(filePath: string, skills: SkillInfo[]): void {
  if (!fs.existsSync(filePath)) return;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rules = JSON.parse(content) as SkillRulesEntry[] | Record<string, SkillRulesEntry>;

    // Handle both array and object formats
    const rulesArray = Array.isArray(rules)
      ? rules
      : Object.entries(rules).map(([key, value]) => ({
          skill: key,
          ...(typeof value === 'object' ? value : {}),
        }));

    for (const rule of rulesArray) {
      const skill = skills.find(
        (s) =>
          s.name.toLowerCase() === rule.skill?.toLowerCase() ||
          path.basename(s.path).toLowerCase() === rule.skill?.toLowerCase()
      );

      if (skill) {
        const triggers = rule.triggers || rule.patterns || [];
        skill.triggers = skill.triggers ? [...skill.triggers, ...triggers] : triggers;
      }
    }
  } catch (error) {
    console.warn(`[SkillManager] Error loading skill-rules from ${filePath}:`, error);
  }
}

// ============================================================
// Skill Content Reading
// ============================================================

/**
 * Read the full content of a skill's SKILL.md
 * @param skillPath - Path to the skill directory
 * @returns The SKILL.md content
 */
export function getSkillContent(skillPath: string): string {
  try {
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    if (!fs.existsSync(skillMdPath)) {
      return `// SKILL.md not found at: ${skillMdPath}`;
    }

    return fs.readFileSync(skillMdPath, 'utf-8');
  } catch (error) {
    console.error('[SkillManager] Error reading skill content:', error);
    return `// Error reading skill: ${error}`;
  }
}

// ============================================================
// Trigger Testing
// ============================================================

interface TriggerTestResult {
  matches: SkillInfo[];
  scores: number[];
}

/**
 * Test if a prompt would trigger any skills based on triggers
 * @param prompt - The user prompt to test
 * @param projectPath - Optional project path for project-specific skills
 * @returns Matching skills and their match scores
 */
export function testSkillTrigger(prompt: string, projectPath?: string): TriggerTestResult {
  const skills = getSkills(projectPath);
  const matches: SkillInfo[] = [];
  const scores: number[] = [];

  const promptLower = prompt.toLowerCase();
  const promptWords = promptLower.split(/\s+/);

  for (const skill of skills) {
    if (!skill.triggers || skill.triggers.length === 0) continue;

    let maxScore = 0;

    for (const trigger of skill.triggers) {
      const triggerLower = trigger.toLowerCase();

      // Check for exact phrase match
      if (promptLower.includes(triggerLower)) {
        const score = triggerLower.length / promptLower.length;
        maxScore = Math.max(maxScore, 0.8 + score * 0.2);
        continue;
      }

      // Check for word-by-word match
      const triggerWords = triggerLower.split(/\s+/);
      const matchedWords = triggerWords.filter((tw) =>
        promptWords.some((pw) => pw.includes(tw) || tw.includes(pw))
      );

      if (matchedWords.length > 0) {
        const score = matchedWords.length / triggerWords.length;
        maxScore = Math.max(maxScore, score * 0.7);
      }

      // Check for pattern match (if trigger looks like a regex)
      if (trigger.startsWith('/') && trigger.endsWith('/')) {
        try {
          const regex = new RegExp(trigger.slice(1, -1), 'i');
          if (regex.test(prompt)) {
            maxScore = Math.max(maxScore, 0.9);
          }
        } catch {
          // Invalid regex, ignore
        }
      }
    }

    if (maxScore > 0.3) {
      matches.push(skill);
      scores.push(Math.round(maxScore * 100) / 100);
    }
  }

  // Sort by score descending
  const indices = scores.map((_, i) => i);
  indices.sort((a, b) => scores[b] - scores[a]);

  return {
    matches: indices.map((i) => matches[i]),
    scores: indices.map((i) => scores[i]),
  };
}
