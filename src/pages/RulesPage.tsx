import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RuleInfo } from '../types/electron';

export function RulesPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRule, setSelectedRule] = useState<RuleInfo | null>(null);
  const [showContentModal, setShowContentModal] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const loadedRules = await window.electronAPI.getRules();
      setRules(loadedRules);
      setError(null);
    } catch (err) {
      setError(`Failed to load rules: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleViewContent = (rule: RuleInfo) => {
    setSelectedRule(rule);
    setShowContentModal(true);
  };

  const handleToggle = async (rule: RuleInfo) => {
    setToggling(rule.path);
    try {
      const result = await window.electronAPI.toggleRule(rule.path, !rule.enabled);
      if (result.success) {
        setRules(prev => prev.map(r => {
          if (r.path === rule.path) {
            return {
              ...r,
              enabled: !r.enabled,
              path: result.newPath || r.path,
              filename: result.newPath ? result.newPath.split('/').pop() || r.filename : r.filename,
            };
          }
          return r;
        }));
      } else {
        setError(result.error || 'Failed to toggle rule');
      }
    } catch (err) {
      setError(`Failed to toggle rule: ${err}`);
    } finally {
      setToggling(null);
    }
  };

  const globalRules = rules.filter(r => r.source === 'global');
  const projectRules = rules.filter(r => r.source === 'project');
  const enabledCount = rules.filter(r => r.enabled).length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-secondary)]">Loading rules...</div>
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
          <svg className="w-5 h-5 text-[var(--text-secondary)] mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">Rules</h1>
          <span className="ml-3 text-xs text-[var(--text-secondary)]">
            {enabledCount}/{rules.length} enabled
          </span>
        </div>
        <button onClick={loadRules} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded" title="Refresh">
          <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </header>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {rules.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">No Rules Found</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Add rules to <code className="bg-[var(--bg-tertiary)] px-1 rounded">~/.claude/rules/</code>
            </p>
          </div>
        ) : (
          <>
            {globalRules.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">Global</span>
                  {globalRules.filter(r => r.enabled).length}/{globalRules.length} enabled
                </h2>
                <div className="space-y-2">
                  {globalRules.map(rule => (
                    <RuleCard key={rule.path} rule={rule} onView={handleViewContent} onToggle={handleToggle} isToggling={toggling === rule.path} />
                  ))}
                </div>
              </div>
            )}

            {projectRules.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Project</span>
                  {projectRules.filter(r => r.enabled).length}/{projectRules.length} enabled
                </h2>
                <div className="space-y-2">
                  {projectRules.map(rule => (
                    <RuleCard key={rule.path} rule={rule} onView={handleViewContent} onToggle={handleToggle} isToggling={toggling === rule.path} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showContentModal && selectedRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-[800px] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-[var(--text-primary)]">{selectedRule.name}</h3>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${selectedRule.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {selectedRule.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{selectedRule.path}</p>
              </div>
              <button onClick={() => setShowContentModal(false)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm font-mono bg-[var(--bg-primary)] p-4 rounded overflow-x-auto whitespace-pre-wrap">
                <code className="text-[var(--text-primary)]">{selectedRule.content}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleCard({ rule, onView, onToggle, isToggling }: { rule: RuleInfo; onView: (r: RuleInfo) => void; onToggle: (r: RuleInfo) => void; isToggling: boolean }) {
  return (
    <div className={`bg-[var(--bg-secondary)] rounded-lg border p-4 ${rule.enabled ? 'border-[var(--border)]' : 'border-[var(--border)] opacity-60'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${rule.enabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{rule.name}</span>
            {!rule.enabled && <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">disabled</span>}
          </div>
          {rule.description && <p className="text-sm text-[var(--text-secondary)] mt-1">{rule.description}</p>}
          <div className="text-xs text-[var(--text-secondary)] mt-1 font-mono">{rule.filename}</div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button onClick={() => onView(rule)} className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] rounded text-[var(--text-secondary)]">View</button>
          <button
            onClick={() => onToggle(rule)}
            disabled={isToggling}
            className={`relative w-10 h-5 rounded-full transition-colors ${rule.enabled ? 'bg-green-500' : 'bg-gray-600'} ${isToggling ? 'opacity-50' : ''}`}
            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${rule.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
