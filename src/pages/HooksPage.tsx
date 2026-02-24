import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HookInfo, HookTestResult, HookEventType } from '../types/electron';

const HOOK_EVENT_TYPES: HookEventType[] = [
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'SessionStart',
  'Stop',
  'SubagentStop',
];

const EVENT_TYPE_DESCRIPTIONS: Record<HookEventType, string> = {
  PreToolUse: 'Runs before a tool is executed. Can block tool execution.',
  PostToolUse: 'Runs after a tool completes. Can add context to conversation.',
  UserPromptSubmit: 'Runs when user submits a prompt. Can modify or block.',
  SessionStart: 'Runs when a session starts, resumes, or clears.',
  Stop: 'Runs when Claude stops generating a response.',
  SubagentStop: 'Runs when a spawned subagent completes.',
};

export function HooksPage() {
  const navigate = useNavigate();
  const [hooks, setHooks] = useState<HookInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHook, setSelectedHook] = useState<HookInfo | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [hookSource, setHookSource] = useState<string>('');
  const [testInput, setTestInput] = useState<string>('{}');
  const [testResult, setTestResult] = useState<HookTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(HOOK_EVENT_TYPES));

  const loadHooks = useCallback(async () => {
    try {
      setLoading(true);
      const loadedHooks = await window.electronAPI.getHooks();
      setHooks(loadedHooks);
      setError(null);
    } catch (err) {
      setError(`Failed to load hooks: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHooks();
  }, [loadHooks]);

  const handleViewSource = async (hook: HookInfo) => {
    setSelectedHook(hook);
    if (hook.path) {
      try {
        const source = await window.electronAPI.getHookSource(hook.path);
        setHookSource(source);
      } catch {
        setHookSource(`// Failed to load source for: ${hook.path}`);
      }
    } else {
      setHookSource(`// No script path detected\n// Command: ${hook.command}`);
    }
    setShowSourceModal(true);
  };

  const handleTestHook = async (hook: HookInfo) => {
    setSelectedHook(hook);
    setTestResult(null);
    try {
      const example = await window.electronAPI.getHookTestExample(hook.eventType);
      setTestInput(JSON.stringify(example, null, 2));
    } catch {
      setTestInput('{}');
    }
    setShowTestModal(true);
  };

  const runTest = async () => {
    if (!selectedHook) return;
    setTesting(true);
    setTestResult(null);
    try {
      const input = JSON.parse(testInput);
      const result = await window.electronAPI.testHook(selectedHook.command, input);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        output: '',
        error: `Invalid JSON or test failed: ${err}`,
        exitCode: -1,
        durationMs: 0,
      });
    } finally {
      setTesting(false);
    }
  };

  const toggleExpand = (eventType: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(eventType)) {
        next.delete(eventType);
      } else {
        next.add(eventType);
      }
      return next;
    });
  };

  const getHooksByEventType = (eventType: string) => {
    return hooks.filter((h) => h.eventType === eventType);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-secondary)]">Loading hooks...</div>
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">Hooks</h1>
          <span className="ml-3 text-xs text-[var(--text-secondary)]">
            {hooks.length} hook{hooks.length !== 1 ? 's' : ''} configured
          </span>
        </div>
        <button
          onClick={loadHooks}
          className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          title="Refresh hooks"
        >
          <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </header>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {hooks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">No Hooks Configured</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              Add hooks to your <code className="bg-[var(--bg-tertiary)] px-1 rounded">~/.claude/settings.json</code> or project's <code className="bg-[var(--bg-tertiary)] px-1 rounded">.claude/settings.json</code>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {HOOK_EVENT_TYPES.map((eventType) => {
              const eventHooks = getHooksByEventType(eventType);
              const isExpanded = expandedTypes.has(eventType);

              return (
                <div key={eventType} className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                  {/* Event Type Header */}
                  <button
                    onClick={() => toggleExpand(eventType)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors rounded-t-lg"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-medium text-[var(--text-primary)]">{eventType}</span>
                      <span className="text-xs px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]">
                        {eventHooks.length}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] max-w-md truncate">
                      {EVENT_TYPE_DESCRIPTIONS[eventType]}
                    </span>
                  </button>

                  {/* Hooks List */}
                  {isExpanded && eventHooks.length > 0 && (
                    <div className="border-t border-[var(--border)]">
                      {eventHooks.map((hook, idx) => (
                        <div
                          key={`${hook.eventType}-${hook.configIndex}-${hook.index}`}
                          className={`px-4 py-3 flex items-center justify-between ${idx !== eventHooks.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--text-primary)]">{hook.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${hook.source === 'global' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                {hook.source}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--text-secondary)] mt-1 font-mono truncate">
                              {hook.command}
                            </div>
                            {hook.matcher && hook.matcher.length > 0 && (
                              <div className="text-xs text-[var(--text-secondary)] mt-1">
                                Matcher: {hook.matcher.join(', ')}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleViewSource(hook)}
                              className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] rounded transition-colors text-[var(--text-secondary)]"
                              title="View source code"
                            >
                              Source
                            </button>
                            <button
                              onClick={() => handleTestHook(hook)}
                              className="px-2 py-1 text-xs bg-[var(--accent-primary)] hover:opacity-90 rounded transition-opacity text-white"
                              title="Test hook with sample input"
                            >
                              Test
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty state for event type */}
                  {isExpanded && eventHooks.length === 0 && (
                    <div className="px-4 py-3 text-sm text-[var(--text-secondary)] border-t border-[var(--border)]">
                      No hooks configured for this event type
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Source Modal */}
      {showSourceModal && selectedHook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[var(--text-primary)]">{selectedHook.name}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{selectedHook.path || 'Inline command'}</p>
              </div>
              <button
                onClick={() => setShowSourceModal(false)}
                className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
              >
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm font-mono bg-[var(--bg-primary)] p-4 rounded overflow-x-auto">
                <code className="text-[var(--text-primary)]">{hookSource}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && selectedHook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[var(--text-primary)]">Test: {selectedHook.name}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Event type: {selectedHook.eventType}
                </p>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
              >
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Input */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Test Input (JSON)
                </label>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  className="w-full h-32 p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded font-mono text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent-primary)]"
                  placeholder='{"prompt": "test"}'
                />
              </div>

              {/* Run Button */}
              <button
                onClick={runTest}
                disabled={testing}
                className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {testing ? 'Running...' : 'Run Test'}
              </button>

              {/* Result */}
              {testResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {testResult.success ? 'Success' : 'Failed'}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      Exit code: {testResult.exitCode} | Duration: {testResult.durationMs}ms
                    </span>
                  </div>

                  {testResult.output && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Output</label>
                      <pre className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-sm font-mono text-green-400 overflow-x-auto max-h-40 overflow-y-auto">
                        {testResult.output}
                      </pre>
                    </div>
                  )}

                  {testResult.error && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Error</label>
                      <pre className="p-3 bg-[var(--bg-primary)] border border-red-500/30 rounded text-sm font-mono text-red-400 overflow-x-auto max-h-40 overflow-y-auto">
                        {testResult.error}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
