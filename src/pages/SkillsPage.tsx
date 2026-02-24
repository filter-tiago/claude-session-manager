import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SkillInfo } from '../types/electron';

export function SkillsPage() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [showContentModal, setShowContentModal] = useState(false);
  const [showTriggerTest, setShowTriggerTest] = useState(false);
  const [triggerTestInput, setTriggerTestInput] = useState('');
  const [triggerMatches, setTriggerMatches] = useState<SkillInfo[]>([]);
  const [testing, setTesting] = useState(false);

  const loadSkills = useCallback(async () => {
    try {
      setLoading(true);
      const loadedSkills = await window.electronAPI.getSkills();
      setSkills(loadedSkills);
      setError(null);
    } catch (err) {
      setError(`Failed to load skills: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleViewContent = (skill: SkillInfo) => {
    setSelectedSkill(skill);
    setShowContentModal(true);
  };

  const handleTestTrigger = async () => {
    if (!triggerTestInput.trim()) return;
    setTesting(true);
    try {
      const result = await window.electronAPI.testSkillTrigger(triggerTestInput);
      setTriggerMatches(result.matches);
    } catch (err) {
      setError(`Trigger test failed: ${err}`);
    } finally {
      setTesting(false);
    }
  };

  const globalSkills = skills.filter(s => s.source === 'global');
  const projectSkills = skills.filter(s => s.source === 'project');

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-secondary)]">Loading skills...</div>
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">Skills</h1>
          <span className="ml-3 text-xs text-[var(--text-secondary)]">
            {skills.length} skill{skills.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTriggerTest(true)}
            className="px-3 py-1 text-xs bg-[var(--accent-primary)] text-white rounded hover:opacity-90"
          >
            Test Triggers
          </button>
          <button onClick={loadSkills} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded" title="Refresh">
            <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {skills.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">No Skills Found</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Add skills to <code className="bg-[var(--bg-tertiary)] px-1 rounded">~/.claude/skills/</code>
            </p>
          </div>
        ) : (
          <>
            {/* Global Skills */}
            {globalSkills.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">Global</span>
                  {globalSkills.length} skill{globalSkills.length !== 1 ? 's' : ''}
                </h2>
                <div className="grid gap-3">
                  {globalSkills.map(skill => (
                    <SkillCard key={skill.path} skill={skill} onView={handleViewContent} />
                  ))}
                </div>
              </div>
            )}

            {/* Project Skills */}
            {projectSkills.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Project</span>
                  {projectSkills.length} skill{projectSkills.length !== 1 ? 's' : ''}
                </h2>
                <div className="grid gap-3">
                  {projectSkills.map(skill => (
                    <SkillCard key={skill.path} skill={skill} onView={handleViewContent} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Content Modal */}
      {showContentModal && selectedSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-[800px] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[var(--text-primary)]">{selectedSkill.name}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{selectedSkill.path}</p>
              </div>
              <button onClick={() => setShowContentModal(false)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm font-mono bg-[var(--bg-primary)] p-4 rounded overflow-x-auto whitespace-pre-wrap">
                <code className="text-[var(--text-primary)]">{selectedSkill.content}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Test Modal */}
      {showTriggerTest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-medium text-[var(--text-primary)]">Test Skill Triggers</h3>
              <button onClick={() => setShowTriggerTest(false)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Enter a prompt to test</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={triggerTestInput}
                    onChange={e => setTriggerTestInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTestTrigger()}
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    placeholder="e.g., commit my changes"
                  />
                  <button
                    onClick={handleTestTrigger}
                    disabled={testing || !triggerTestInput.trim()}
                    className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded hover:opacity-90 disabled:opacity-50"
                  >
                    {testing ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              {triggerMatches.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Matched Skills ({triggerMatches.length})</h4>
                  <div className="space-y-2">
                    {triggerMatches.map(skill => (
                      <div key={skill.path} className="p-3 bg-[var(--bg-primary)] rounded border border-green-500/30">
                        <div className="font-medium text-[var(--text-primary)]">{skill.name}</div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1">{skill.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {triggerTestInput && triggerMatches.length === 0 && !testing && (
                <div className="text-sm text-[var(--text-secondary)] text-center py-4">
                  No skills matched this prompt
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillCard({ skill, onView }: { skill: SkillInfo; onView: (s: SkillInfo) => void }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--text-primary)]">{skill.name}</span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{skill.description}</p>
          {skill.triggers && skill.triggers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {skill.triggers.slice(0, 5).map((t, i) => (
                <span key={i} className="px-1.5 py-0.5 text-xs bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]">
                  {t}
                </span>
              ))}
              {skill.triggers.length > 5 && (
                <span className="text-xs text-[var(--text-secondary)]">+{skill.triggers.length - 5} more</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => onView(skill)}
          className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] rounded text-[var(--text-secondary)]"
        >
          View
        </button>
      </div>
    </div>
  );
}
