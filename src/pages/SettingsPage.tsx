import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ClaudeSettings, SettingsScope } from '../types/electron';

type TabType = 'global' | 'project';

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('global');
  const [_globalSettings, setGlobalSettings] = useState<ClaudeSettings>({});
  const [_projectSettings, setProjectSettings] = useState<ClaudeSettings>({});
  const [globalText, setGlobalText] = useState('');
  const [projectText, setProjectText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showDiff, setShowDiff] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const global = await window.electronAPI.getSettings('global');
      const project = await window.electronAPI.getSettings('project');
      setGlobalSettings(global);
      setProjectSettings(project);
      setGlobalText(JSON.stringify(global, null, 2));
      setProjectText(JSON.stringify(project, null, 2));
      setError(null);
    } catch (err) {
      setError(`Failed to load settings: ${err}`);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onSettingsChanged((event) => {
      if (event.type === 'settings') {
        loadSettings();
      }
    });
    return unsubscribe;
  }, [loadSettings]);

  const validateJson = (text: string): { valid: boolean; error?: string } => {
    try {
      JSON.parse(text);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: String(err) };
    }
  };

  const handleSave = async (scope: SettingsScope) => {
    const text = scope === 'global' ? globalText : projectText;
    const validation = validateJson(text);

    if (!validation.valid) {
      setError(`Invalid JSON: ${validation.error}`);
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saving');
    try {
      const settings = JSON.parse(text);
      const result = await window.electronAPI.saveSettings(scope, settings);
      if (result.success) {
        setSaveStatus('saved');
        setError(null);
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setError('Failed to save settings');
      }
    } catch (err) {
      setSaveStatus('error');
      setError(`Failed to save: ${err}`);
    }
  };

  const getCurrentText = () => (activeTab === 'global' ? globalText : projectText);
  const setCurrentText = (text: string) => {
    if (activeTab === 'global') {
      setGlobalText(text);
    } else {
      setProjectText(text);
    }
  };

  const currentValidation = validateJson(getCurrentText());

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="h-12 bg-[var(--bg-secondary)] flex items-center justify-between px-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
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
            className="w-5 h-5 text-[var(--text-secondary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">Settings</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              showDiff
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
            }`}
          >
            {showDiff ? 'Hide Diff' : 'Show Diff'}
          </button>
          <button
            onClick={loadSettings}
            className="px-3 py-1.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded hover:bg-[var(--border)] transition-colors"
          >
            Reload
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <button
          onClick={() => setActiveTab('global')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'global'
              ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Global Settings
        </button>
        <button
          onClick={() => setActiveTab('project')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'project'
              ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Project Settings
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {showDiff ? (
          /* Diff View - Side by Side */
          <div className="flex-1 flex gap-4 p-4 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
                Global
              </div>
              <textarea
                value={globalText}
                onChange={(e) => setGlobalText(e.target.value)}
                className="flex-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-mono text-sm p-3 rounded border border-[var(--border)] resize-none focus:outline-none focus:border-[var(--accent-primary)]"
                spellCheck={false}
              />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
                Project
              </div>
              <textarea
                value={projectText}
                onChange={(e) => setProjectText(e.target.value)}
                className="flex-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-mono text-sm p-3 rounded border border-[var(--border)] resize-none focus:outline-none focus:border-[var(--accent-primary)]"
                spellCheck={false}
              />
            </div>
          </div>
        ) : (
          /* Single Editor View */
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              {activeTab === 'global' ? 'Global Settings (~/.claude/settings.json)' : 'Project Settings (.claude/settings.json)'}
            </div>
            <textarea
              value={getCurrentText()}
              onChange={(e) => setCurrentText(e.target.value)}
              className={`flex-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-mono text-sm p-4 rounded border resize-none focus:outline-none ${
                currentValidation.valid
                  ? 'border-[var(--border)] focus:border-[var(--accent-primary)]'
                  : 'border-[var(--error)]'
              }`}
              spellCheck={false}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="h-14 bg-[var(--bg-secondary)] flex items-center justify-between px-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-2 text-xs text-[var(--error)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="truncate max-w-md">{error}</span>
            </div>
          )}
          {!currentValidation.valid && !error && (
            <div className="flex items-center gap-2 text-xs text-[var(--warning)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>Invalid JSON - fix errors before saving</span>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-2 text-xs text-[var(--success)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Saved successfully</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showDiff ? (
            <>
              <button
                onClick={() => handleSave('global')}
                disabled={!validateJson(globalText).valid || saveStatus === 'saving'}
                className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Global
              </button>
              <button
                onClick={() => handleSave('project')}
                disabled={!validateJson(projectText).valid || saveStatus === 'saving'}
                className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Project
              </button>
            </>
          ) : (
            <button
              onClick={() => handleSave(activeTab)}
              disabled={!currentValidation.valid || saveStatus === 'saving'}
              className="px-4 py-1.5 text-xs bg-[var(--accent-primary)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
