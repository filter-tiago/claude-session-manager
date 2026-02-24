/**
 * AI Analyzer Service
 *
 * Context-aware analysis with rules + optional LLM enhancement.
 *
 * Two paths:
 * - Fast path (rule-based): Always runs first, provides basic analysis
 * - Rich path (Claude API): Triggered when importance > 50, adds deep insights
 *
 * Features:
 * - Importance scoring based on session activity
 * - Summary extraction from last messages
 * - Category detection (feature/bugfix/refactor/docs/chat)
 * - Optional Claude API enhancement with caching
 */

import type { SessionNotificationEvent } from '../../src/types/notifications';

// ============================================================================
// Types
// ============================================================================

export interface AIAnalysisResult {
  importanceScore: number;
  summary: string;
  category: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'chat' | 'unknown';
  suggestedAction?: string;
  analyzedBy: 'rules' | 'claude-api';
}

interface CacheEntry {
  result: AIAnalysisResult;
  cachedAt: number;
}

// ============================================================================
// Configuration
// ============================================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const IMPORTANCE_THRESHOLD_FOR_API = 50;
const API_TIMEOUT_MS = 10000; // 10 seconds

// Cache for API results (keyed by eventId)
const analysisCache = new Map<string, CacheEntry>();

// ============================================================================
// Rule-Based Analysis (Fast Path)
// ============================================================================

/**
 * Extract keywords that indicate work type
 */
function detectCategory(event: SessionNotificationEvent): AIAnalysisResult['category'] {
  const messages = event.lastMessages.join(' ').toLowerCase();
  const files = event.filesModified.join(' ').toLowerCase();

  // Check for bug/fix patterns
  if (
    messages.includes('fix') ||
    messages.includes('bug') ||
    messages.includes('error') ||
    messages.includes('issue') ||
    messages.includes('patch')
  ) {
    return 'bugfix';
  }

  // Check for feature patterns
  if (
    messages.includes('add') ||
    messages.includes('implement') ||
    messages.includes('create') ||
    messages.includes('new feature') ||
    messages.includes('build')
  ) {
    return 'feature';
  }

  // Check for refactor patterns
  if (
    messages.includes('refactor') ||
    messages.includes('clean up') ||
    messages.includes('reorganize') ||
    messages.includes('rename') ||
    messages.includes('restructure')
  ) {
    return 'refactor';
  }

  // Check for docs patterns
  if (
    messages.includes('document') ||
    messages.includes('readme') ||
    messages.includes('comment') ||
    files.includes('.md') ||
    files.includes('readme')
  ) {
    return 'docs';
  }

  // Check if it's just conversation (no files modified, mostly Read/chat)
  if (event.filesModified.length === 0 && event.toolsUsed.every(t => ['Read', 'Grep', 'Glob'].includes(t))) {
    return 'chat';
  }

  return 'unknown';
}

/**
 * Calculate importance score based on event data
 * Enhanced version with more factors
 */
function calculateImportanceScore(event: SessionNotificationEvent): number {
  let score = 0;

  // Files modified contribute significantly
  score += Math.min(event.filesModified.length * 10, 40); // Cap at 40

  // Certain tools indicate substantial work
  const heavyTools = ['Write', 'Edit', 'Bash', 'NotebookEdit'];
  const heavyToolCount = event.toolsUsed.filter(t => heavyTools.includes(t)).length;
  score += Math.min(heavyToolCount * 5, 25); // Cap at 25

  // Pre-analysis factors
  if (event.preAnalysis.codeChanged) score += 15;
  if (event.preAnalysis.buildRan) score += 10;
  if (event.preAnalysis.testsRan) score += 10;

  // Verification required indicates blocked/needs attention
  if (event.verification.required && !event.verification.passed) {
    score += 30;
  }

  // Stop type bonuses
  if (event.stopType === 'blocked') score += 20;
  if (event.stopType === 'error') score += 25;

  // Message content analysis
  const messages = event.lastMessages.join(' ').toLowerCase();
  if (messages.includes('breaking') || messages.includes('critical')) score += 10;
  if (messages.includes('test') && messages.includes('pass')) score += 5;

  return Math.min(score, 100); // Cap at 100
}

/**
 * Extract a summary from the last messages using rules
 */
function extractSummaryFromMessages(event: SessionNotificationEvent): string {
  const lastMessages = event.lastMessages;

  if (lastMessages.length === 0) {
    return `Session ${event.stopType} in ${event.projectName}`;
  }

  // Get the last substantive message (not just "done" or "ok")
  const substantiveMessage = lastMessages.reverse().find(msg => msg.length > 20);

  if (substantiveMessage) {
    // Extract first sentence or first 100 chars
    const firstSentence = substantiveMessage.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length > 10) {
      return firstSentence.trim().slice(0, 100);
    }
  }

  // Fall back to file-based summary
  const filesCount = event.filesModified.length;
  if (filesCount > 0) {
    const firstFile = event.filesModified[0].split('/').pop() || event.filesModified[0];
    if (filesCount === 1) {
      return `Modified ${firstFile}`;
    }
    return `Modified ${firstFile} and ${filesCount - 1} other file${filesCount > 2 ? 's' : ''}`;
  }

  return `Session ${event.stopType}`;
}

/**
 * Generate suggested action based on stop type and context
 */
function generateSuggestedAction(event: SessionNotificationEvent): string | undefined {
  switch (event.stopType) {
    case 'blocked':
      if (event.verification.reason) {
        return `Review: ${event.verification.reason}`;
      }
      return 'Review session and provide input';

    case 'error':
      return 'Check error logs and investigate';

    case 'completed':
      if (event.preAnalysis.testsRan && event.verification.passed) {
        return 'Ready for review and merge';
      }
      if (event.preAnalysis.codeChanged && !event.preAnalysis.testsRan) {
        return 'Consider running tests';
      }
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Perform rule-based analysis (fast path)
 */
function analyzeWithRules(event: SessionNotificationEvent): AIAnalysisResult {
  const importanceScore = calculateImportanceScore(event);
  const summary = extractSummaryFromMessages(event);
  const category = detectCategory(event);
  const suggestedAction = generateSuggestedAction(event);

  return {
    importanceScore,
    summary,
    category,
    suggestedAction,
    analyzedBy: 'rules',
  };
}

// ============================================================================
// Claude API Analysis (Rich Path)
// ============================================================================

/**
 * Build prompt for Claude API
 */
function buildClaudePrompt(event: SessionNotificationEvent): string {
  return `Analyze this Claude CLI session notification and provide a concise summary.

Session Info:
- Project: ${event.projectName}
- Stop Type: ${event.stopType}
- Files Modified: ${event.filesModified.length > 0 ? event.filesModified.join(', ') : 'None'}
- Tools Used: ${event.toolsUsed.join(', ')}
- Verification: ${event.verification.required ? (event.verification.passed ? 'Passed' : `Failed: ${event.verification.reason}`) : 'Not required'}

Last Messages:
${event.lastMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Respond with JSON only (no markdown):
{
  "summary": "One sentence describing what was accomplished or blocked",
  "importance": 0-100,
  "suggestedAction": "What should the user do next (or null if nothing)"
}`;
}

/**
 * Call Claude API for enhanced analysis
 */
async function callClaudeAPI(event: SessionNotificationEvent): Promise<AIAnalysisResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log('[AIAnalyzer] No ANTHROPIC_API_KEY found, skipping API enhancement');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Fast, cheap model for this use case
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: buildClaudePrompt(event),
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[AIAnalyzer] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as { content?: Array<{ text?: string }> };
    const content = data.content?.[0]?.text;

    if (!content) {
      console.error('[AIAnalyzer] No content in API response');
      return null;
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);

    return {
      importanceScore: Math.min(Math.max(parsed.importance || 50, 0), 100),
      summary: parsed.summary || 'Session completed',
      category: detectCategory(event), // Keep rule-based category
      suggestedAction: parsed.suggestedAction || undefined,
      analyzedBy: 'claude-api',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[AIAnalyzer] API call timed out');
    } else {
      console.error('[AIAnalyzer] API call failed:', error);
    }
    return null;
  }
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Get cached result if valid
 */
function getCachedResult(eventId: string): AIAnalysisResult | null {
  const cached = analysisCache.get(eventId);

  if (!cached) return null;

  const age = Date.now() - cached.cachedAt;
  if (age > CACHE_TTL_MS) {
    analysisCache.delete(eventId);
    return null;
  }

  return cached.result;
}

/**
 * Cache a result
 */
function cacheResult(eventId: string, result: AIAnalysisResult): void {
  // Clean old entries if cache is getting large
  if (analysisCache.size > 100) {
    const now = Date.now();
    for (const [key, entry] of analysisCache) {
      if (now - entry.cachedAt > CACHE_TTL_MS) {
        analysisCache.delete(key);
      }
    }
  }

  analysisCache.set(eventId, {
    result,
    cachedAt: Date.now(),
  });
}

/**
 * Clear the analysis cache
 */
export function clearAnalysisCache(): void {
  analysisCache.clear();
  console.log('[AIAnalyzer] Cache cleared');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Analyze a session notification event
 *
 * Two paths:
 * 1. Fast path (rule-based): Always runs, provides basic analysis
 * 2. Rich path (Claude API): Runs if importance > 50 and API key available
 *
 * Results are cached for 5 minutes to avoid duplicate API calls.
 */
export async function analyzeSession(event: SessionNotificationEvent): Promise<AIAnalysisResult> {
  // Check cache first
  const cached = getCachedResult(event.eventId);
  if (cached) {
    console.log(`[AIAnalyzer] Using cached result for ${event.eventId}`);
    return cached;
  }

  // Always start with rule-based analysis
  const rulesResult = analyzeWithRules(event);
  console.log(`[AIAnalyzer] Rules analysis: score=${rulesResult.importanceScore}, category=${rulesResult.category}`);

  // Only call API if importance is high enough
  if (rulesResult.importanceScore >= IMPORTANCE_THRESHOLD_FOR_API) {
    console.log(`[AIAnalyzer] Importance ${rulesResult.importanceScore} >= ${IMPORTANCE_THRESHOLD_FOR_API}, trying API enhancement`);

    const apiResult = await callClaudeAPI(event);

    if (apiResult) {
      console.log(`[AIAnalyzer] API enhancement successful: "${apiResult.summary}"`);
      cacheResult(event.eventId, apiResult);
      return apiResult;
    }

    // API failed, fall back to rules
    console.log('[AIAnalyzer] API enhancement failed, using rules result');
  }

  // Cache and return rules result
  cacheResult(event.eventId, rulesResult);
  return rulesResult;
}

/**
 * Synchronous rule-based analysis (for when async is not possible)
 */
export function analyzeSessionSync(event: SessionNotificationEvent): AIAnalysisResult {
  const cached = getCachedResult(event.eventId);
  if (cached) {
    return cached;
  }

  const result = analyzeWithRules(event);
  cacheResult(event.eventId, result);
  return result;
}
