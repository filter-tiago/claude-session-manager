import { useState, useCallback, useEffect } from 'react';

interface NewSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSpawn: (projectPath: string, options?: { task?: string; ledger?: string }) => Promise<void>;
}

interface RecentProject {
  path: string;
  name: string;
  lastUsed: string;
}

export function NewSessionDialog({ isOpen, onClose, onSpawn }: NewSessionDialogProps) {
  const [projectPath, setProjectPath] = useState('');
  const [task, setTask] = useState('');
  const [ledger, setLedger] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Load recent projects from sessions
  useEffect(() => {
    if (isOpen) {
      loadRecentProjects();
    }
  }, [isOpen]);

  const loadRecentProjects = async () => {
    try {
      const sessions = await window.electronAPI.getSessions();
      const projectMap = new Map<string, RecentProject>();

      for (const session of sessions) {
        if (!projectMap.has(session.project_path)) {
          projectMap.set(session.project_path, {
            path: session.project_path,
            name: session.project_name,
            lastUsed: session.last_activity,
          });
        }
      }

      const projects = Array.from(projectMap.values())
        .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
        .slice(0, 10);

      setRecentProjects(projects);
    } catch (err) {
      console.error('Failed to load recent projects:', err);
    }
  };

  const handleSpawn = useCallback(async () => {
    if (!projectPath.trim()) {
      setError('Project path is required');
      return;
    }

    setIsSpawning(true);
    setError(null);

    try {
      await onSpawn(projectPath, {
        task: task.trim() || undefined,
        ledger: ledger.trim() || undefined,
      });
      // Reset form and close
      setProjectPath('');
      setTask('');
      setLedger('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to spawn session');
    } finally {
      setIsSpawning(false);
    }
  }, [projectPath, task, ledger, onSpawn, onClose]);

  const handleSelectRecentProject = (path: string) => {
    setProjectPath(path);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-[var(--bg-secondary)] rounded-lg shadow-xl w-full max-w-lg mx-4 border border-[var(--border)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">New Claude Session</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Project path input */}
          <div>
            <label className="text-sm text-[var(--text-secondary)] mb-1 block">
              Project Path <span className="text-[var(--accent-primary)]">*</span>
            </label>
            <input
              type="text"
              value={projectPath}
              onChange={(e) => {
                setProjectPath(e.target.value);
                setError(null);
              }}
              placeholder="/Users/you/workspace/project"
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent-primary)] font-mono"
            />
          </div>

          {/* Recent projects */}
          {recentProjects.length > 0 && !projectPath && (
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-2 block">
                Recent Projects
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {recentProjects.map((project) => (
                  <button
                    key={project.path}
                    onClick={() => handleSelectRecentProject(project.path)}
                    className="w-full px-3 py-2 text-left bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                  >
                    <div className="text-sm font-medium">{project.name}</div>
                    <div className="text-xs text-[var(--text-secondary)] truncate font-mono">
                      {project.path}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Task input */}
          <div>
            <label className="text-sm text-[var(--text-secondary)] mb-1 block">
              Initial Task <span className="text-xs">(optional)</span>
            </label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what you want to accomplish..."
              rows={2}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent-primary)] resize-none"
            />
          </div>

          {/* Ledger input */}
          <div>
            <label className="text-sm text-[var(--text-secondary)] mb-1 block">
              Resume Ledger <span className="text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={ledger}
              onChange={(e) => setLedger(e.target.value)}
              placeholder="CONTINUITY_CLAUDE-session-name"
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent-primary)] font-mono"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="px-3 py-2 bg-[var(--error)]/10 border border-[var(--error)] rounded-lg text-sm text-[var(--error)]">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSpawn}
            disabled={isSpawning || !projectPath.trim()}
            className="px-4 py-2 text-sm bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSpawning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Spawning...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Spawn Session
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
