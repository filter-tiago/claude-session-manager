import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SkillInfo, RuleInfo } from '../types/electron';

type PluginType = 'skill' | 'rule';
type FilterType = 'all' | 'skills' | 'rules';

interface Plugin {
  type: PluginType;
  name: string;
  description?: string;
  source: 'global' | 'project';
  path: string;
  enabled: boolean;
  content?: string;
  triggers?: string[];
  globs?: string[];
}

interface ContentViewerModalProps {
  isOpen: boolean;
  plugin: Plugin | null;
  onClose: () => void;
}

function ContentViewerModal({ isOpen, plugin, onClose }: ContentViewerModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !plugin) {
      setContent('');
      return;
    }

    setLoading(true);

    const loadContent = async () => {
      try {
        if (plugin.type === 'skill') {
          const skillContent = await window.electronAPI.getSkillContent(plugin.path);
          setContent(skillContent);
        } else {
          const ruleContent = await window.electronAPI.getRuleContent(plugin.path);
          setContent(ruleContent);
        }
      } catch (error) {
        console.error('Failed to load content:', error);
        setContent('Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [isOpen, plugin]);

  if (!isOpen || !plugin) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            {plugin.type === 'skill' ? (
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{plugin.name}</h2>
            <span className={`px-1.5 py-0.5 text-xs rounded ${
              plugin.type === 'skill' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'
            }`}>
              {plugin.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-56px)]">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-[var(--bg-tertiary)] rounded w-full" style={{ width: `${80 + Math.random() * 20}%` }} />
              ))}
            </div>
          ) : (
            <pre className="text-sm font-mono text-[var(--text-primary)] whitespace-pre-wrap overflow-x-auto">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

interface PluginCardProps {
  plugin: Plugin;
  onView: () => void;
  onToggle?: () => void;
}

function PluginCard({ plugin, onView, onToggle }: PluginCardProps) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Name and badges */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {/* Type icon */}
            {plugin.type === 'skill' ? (
              <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}

            <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
              {plugin.name}
            </h3>

            {/* Source badge */}
            <span className={`px-1.5 py-0.5 text-xs rounded flex-shrink-0 ${
              plugin.source === 'global' ? 'bg-gray-700 text-gray-300' : 'bg-green-900/50 text-green-300'
            }`}>
              {plugin.source}
            </span>

            {/* Disabled badge for rules */}
            {plugin.type === 'rule' && !plugin.enabled && (
              <span className="px-1.5 py-0.5 text-xs bg-yellow-900/50 text-yellow-300 rounded flex-shrink-0">
                disabled
              </span>
            )}
          </div>

          {/* Description */}
          {plugin.description && (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">
              {plugin.description}
            </p>
          )}

          {/* Triggers for skills */}
          {plugin.triggers && plugin.triggers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {plugin.triggers.slice(0, 3).map((trigger, i) => (
                <span key={i} className="px-1.5 py-0.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded font-mono">
                  {trigger}
                </span>
              ))}
              {plugin.triggers.length > 3 && (
                <span className="px-1.5 py-0.5 text-xs text-[var(--text-muted)]">
                  +{plugin.triggers.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Globs for rules */}
          {plugin.globs && plugin.globs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {plugin.globs.slice(0, 3).map((glob, i) => (
                <span key={i} className="px-1.5 py-0.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded font-mono">
                  {glob}
                </span>
              ))}
              {plugin.globs.length > 3 && (
                <span className="px-1.5 py-0.5 text-xs text-[var(--text-muted)]">
                  +{plugin.globs.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {/* Toggle for rules */}
          {plugin.type === 'rule' && onToggle && (
            <button
              onClick={onToggle}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                plugin.enabled ? 'bg-green-600' : 'bg-gray-600'
              }`}
              title={plugin.enabled ? 'Disable' : 'Enable'}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  plugin.enabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          )}

          {/* View button */}
          <button
            onClick={onView}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded"
            title="View content"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export function PluginsPage() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewingPlugin, setViewingPlugin] = useState<Plugin | null>(null);

  const loadPlugins = useCallback(async () => {
    try {
      const [skillsData, rulesData] = await Promise.all([
        window.electronAPI.getSkills(),
        window.electronAPI.getRules(),
      ]);
      setSkills(skillsData);
      setRules(rulesData);
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleToggleRule = async (rule: RuleInfo) => {
    try {
      await window.electronAPI.toggleRule(rule.path, !rule.enabled);
      await loadPlugins();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  // Convert to unified plugin format
  const plugins: Plugin[] = [
    ...skills.map((skill): Plugin => ({
      type: 'skill',
      name: skill.name,
      description: skill.description,
      source: skill.source,
      path: skill.path,
      enabled: true, // Skills are always enabled
      triggers: skill.triggers,
    })),
    ...rules.map((rule): Plugin => ({
      type: 'rule',
      name: rule.name,
      description: rule.description,
      source: rule.source,
      path: rule.path,
      enabled: rule.enabled,
      globs: rule.globs,
    })),
  ];

  // Apply filter
  const filteredPlugins = plugins.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'skills') return p.type === 'skill';
    if (filter === 'rules') return p.type === 'rule';
    return true;
  });

  // Sort: enabled first, then alphabetically
  filteredPlugins.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Stats
  const skillCount = skills.length;
  const ruleCount = rules.length;
  const enabledRuleCount = rules.filter((r) => r.enabled).length;

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
          <svg
            className="w-5 h-5 text-[var(--text-secondary)] mr-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"
            />
          </svg>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">Plugins</h1>
        </div>

        <button
          onClick={loadPlugins}
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </header>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm text-[var(--text-secondary)]">{skillCount} skills</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm text-[var(--text-secondary)]">{enabledRuleCount}/{ruleCount} rules</span>
        </div>

        <div className="flex-1" />

        {/* Filter tabs */}
        <div className="flex items-center bg-[var(--bg-tertiary)] rounded-lg p-0.5">
          {(['all', 'skills', 'rules'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === f
                  ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 animate-pulse"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded bg-[var(--bg-tertiary)]" />
                  <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded" />
                  <div className="h-4 w-16 bg-[var(--bg-tertiary)] rounded" />
                </div>
                <div className="h-3 w-48 bg-[var(--bg-tertiary)] rounded" />
              </div>
            ))}
          </div>
        ) : filteredPlugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[var(--text-secondary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">
              No {filter === 'all' ? 'Plugins' : filter === 'skills' ? 'Skills' : 'Rules'} Found
            </h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md">
              {filter === 'skills'
                ? 'Skills are defined in ~/.claude/skills/ or .claude/skills/ directories.'
                : filter === 'rules'
                ? 'Rules are defined in ~/.claude/rules/ or .claude/rules/ directories.'
                : 'No skills or rules found. Add them to extend Claude\'s capabilities.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPlugins.map((plugin) => (
              <PluginCard
                key={`${plugin.type}-${plugin.path}`}
                plugin={plugin}
                onView={() => setViewingPlugin(plugin)}
                onToggle={
                  plugin.type === 'rule'
                    ? () => {
                        const rule = rules.find((r) => r.path === plugin.path);
                        if (rule) handleToggleRule(rule);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Content viewer modal */}
      <ContentViewerModal
        isOpen={viewingPlugin !== null}
        plugin={viewingPlugin}
        onClose={() => setViewingPlugin(null)}
      />
    </div>
  );
}
