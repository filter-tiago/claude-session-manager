import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  CorrectionPattern,
  WorkflowPattern,
  RuleSuggestion,
  ConfigHealth,
  ToolUsageStats,
} from '../types/electron';

// ============================================================================
// Icons
// ============================================================================

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ============================================================================
// Config Health Card
// ============================================================================

function ConfigHealthCard({ health }: { health: ConfigHealth }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Attention';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-red-400 bg-red-500/10';
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/10';
      default:
        return 'text-blue-400 bg-blue-500/10';
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Config Health</h3>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${getScoreColor(health.score)}`}>
            {health.score}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            {getScoreLabel(health.score)}
          </span>
        </div>
      </div>

      {/* Score gauge */}
      <div className="h-2 bg-[var(--bg-tertiary)] rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            health.score >= 80
              ? 'bg-green-500'
              : health.score >= 60
                ? 'bg-yellow-500'
                : 'bg-red-500'
          }`}
          style={{ width: `${health.score}%` }}
        />
      </div>

      {/* Issues list */}
      {health.issues.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {health.issues.map((issue) => (
            <div
              key={issue.id}
              className={`px-3 py-2 rounded text-xs ${getSeverityColor(issue.severity)}`}
            >
              <div className="flex items-start gap-2">
                {issue.severity === 'error' ? (
                  <WarningIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                ) : issue.severity === 'warning' ? (
                  <WarningIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                ) : (
                  <LightbulbIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <span className="font-medium">{issue.category}:</span> {issue.message}
                  {issue.suggestion && (
                    <p className="text-[var(--text-secondary)] mt-0.5">{issue.suggestion}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircleIcon className="w-4 h-4" />
          <span>All checks passed</span>
        </div>
      )}

      <div className="mt-3 text-xs text-[var(--text-secondary)]">
        Last checked: {new Date(health.lastChecked).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ============================================================================
// Corrections List
// ============================================================================

function CorrectionsList({ corrections }: { corrections: CorrectionPattern[] }) {
  const [filter, setFilter] = useState<string>('all');

  const filteredCorrections =
    filter === 'all' ? corrections : corrections.filter((c) => c.type === filter);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'file_revert':
        return 'File Revert';
      case 'undo_edit':
        return 'Quick Edit';
      case 'retry_command':
        return 'Retry';
      case 'error_fix':
        return 'Error Fix';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error_fix':
        return 'bg-red-500/20 text-red-400';
      case 'retry_command':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'undo_edit':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getSeverityDot = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Correction Patterns</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)]"
        >
          <option value="all">All Types</option>
          <option value="error_fix">Error Fixes</option>
          <option value="retry_command">Retries</option>
          <option value="undo_edit">Quick Edits</option>
          <option value="file_revert">Reverts</option>
        </select>
      </div>

      {filteredCorrections.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
          No correction patterns detected
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredCorrections.slice(0, 20).map((correction, idx) => (
            <div
              key={`${correction.sessionId}-${idx}`}
              className="flex items-start gap-3 p-2 rounded bg-[var(--bg-tertiary)]"
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 ${getSeverityDot(correction.severity)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${getTypeColor(correction.type)}`}>
                    {getTypeLabel(correction.type)}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {new Date(correction.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-primary)] truncate">{correction.context}</p>
                {correction.filesAffected.length > 0 && (
                  <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                    Files: {correction.filesAffected.join(', ')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-[var(--text-secondary)]">
        {corrections.length} patterns detected
      </div>
    </div>
  );
}

// ============================================================================
// Workflow Patterns
// ============================================================================

function WorkflowPatterns({ workflows }: { workflows: WorkflowPattern[] }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Workflow Patterns</h3>

      {workflows.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
          No workflow patterns detected yet
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {workflows.slice(0, 10).map((workflow) => (
            <div
              key={workflow.name}
              className="p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border)]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">{workflow.name}</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {workflow.frequency}x used
                </span>
              </div>

              {/* Sequence visualization */}
              <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                {workflow.sequence.map((tool, idx) => (
                  <div key={idx} className="flex items-center">
                    <span className="px-2 py-0.5 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-primary)]">
                      {tool}
                    </span>
                    {idx < workflow.sequence.length - 1 && (
                      <ArrowRightIcon className="w-3 h-3 text-[var(--text-secondary)] mx-0.5" />
                    )}
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                <span>
                  Success:{' '}
                  <span
                    className={
                      workflow.successRate >= 80
                        ? 'text-green-400'
                        : workflow.successRate >= 60
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }
                  >
                    {workflow.successRate}%
                  </span>
                </span>
                <span>Avg: {Math.round(workflow.avgDurationMs / 1000)}s</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Rule Suggestions
// ============================================================================

function RuleSuggestions({ suggestions }: { suggestions: RuleSuggestion[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.id));

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'hook':
        return '🪝';
      case 'skill':
        return '⚡';
      case 'rule':
        return '📝';
      default:
        return '💡';
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Suggestions</h3>

      {visibleSuggestions.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
          <LightbulbIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No suggestions at this time
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {visibleSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border)]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span>{getTypeIcon(suggestion.type)}</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {suggestion.name}
                  </span>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">
                  {Math.round(suggestion.confidence * 100)}% confidence
                </span>
              </div>

              <p className="text-xs text-[var(--text-secondary)] mb-3">{suggestion.reason}</p>

              <div className="flex items-center gap-2">
                {suggestion.template && (
                  <button
                    className="px-2 py-1 text-xs bg-[var(--accent)] text-white rounded hover:opacity-90"
                    onClick={() => {
                      navigator.clipboard.writeText(suggestion.template!);
                    }}
                  >
                    Copy Template
                  </button>
                )}
                <button
                  className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  onClick={() => handleDismiss(suggestion.id)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tool Usage Stats
// ============================================================================

function ToolUsageCard({ stats }: { stats: ToolUsageStats[] }) {
  const maxCount = Math.max(...stats.map((s) => s.count), 1);

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Tool Usage</h3>

      {stats.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
          No tool usage data available
        </div>
      ) : (
        <div className="space-y-2">
          {stats.slice(0, 8).map((stat) => (
            <div key={stat.tool} className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-primary)] w-16 truncate">{stat.tool}</span>
              <div className="flex-1 h-4 bg-[var(--bg-tertiary)] rounded overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded"
                  style={{ width: `${(stat.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs text-[var(--text-secondary)] w-12 text-right">
                {stat.count}
              </span>
              {stat.errorRate > 0 && (
                <span className="text-xs text-red-400 w-10 text-right">{stat.errorRate}% err</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Insights Page
// ============================================================================

export function InsightsPage() {
  const navigate = useNavigate();
  const [corrections, setCorrections] = useState<CorrectionPattern[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowPattern[]>([]);
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [configHealth, setConfigHealth] = useState<ConfigHealth | null>(null);
  const [toolStats, setToolStats] = useState<ToolUsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [correctionsData, workflowsData, suggestionsData, healthData, statsData] =
        await Promise.all([
          window.electronAPI.getSessionCorrections({ limit: 50 }),
          window.electronAPI.getWorkflowPatterns(),
          window.electronAPI.getRuleSuggestions(),
          window.electronAPI.getConfigHealth(),
          window.electronAPI.getToolUsageStats(),
        ]);

      setCorrections(correctionsData);
      setWorkflows(workflowsData);
      setSuggestions(suggestionsData);
      setConfigHealth(healthData);
      setToolStats(statsData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await window.electronAPI.refreshInsights();
      await loadData();
    } catch (error) {
      console.error('Failed to refresh insights:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-primary)]">
        <header className="h-12 bg-[var(--bg-secondary)] flex items-center px-4 border-b border-[var(--border)]">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mr-2"
            title="Back to sessions"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <ChartIcon className="w-5 h-5 text-[var(--text-secondary)] mr-3" />
          <h1 className="text-base font-semibold text-[var(--text-primary)]">Insights</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-[var(--text-secondary)]">Loading insights...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="h-12 bg-[var(--bg-secondary)] flex items-center justify-between px-4 border-b border-[var(--border)]">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mr-2"
            title="Back to sessions"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <ChartIcon className="w-5 h-5 text-[var(--text-secondary)] mr-3" />
          <h1 className="text-base font-semibold text-[var(--text-primary)]">Insights</h1>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-[var(--text-secondary)]">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--border)] rounded transition-colors disabled:opacity-50"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Config Health - full width on mobile, half on desktop */}
          {configHealth && <ConfigHealthCard health={configHealth} />}

          {/* Tool Usage */}
          <ToolUsageCard stats={toolStats} />

          {/* Corrections */}
          <CorrectionsList corrections={corrections} />

          {/* Workflows */}
          <WorkflowPatterns workflows={workflows} />

          {/* Suggestions - full width */}
          <div className="lg:col-span-2">
            <RuleSuggestions suggestions={suggestions} />
          </div>
        </div>
      </div>
    </div>
  );
}
