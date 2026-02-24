import { useState, useEffect } from 'react';
import type { CreateWorkspaceOptions } from '../../types/electron';

interface NewWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (options: CreateWorkspaceOptions) => Promise<{ success: boolean; error?: string }>;
}

export function NewWorkspaceDialog({
  isOpen,
  onClose,
  onCreate,
}: NewWorkspaceDialogProps) {
  const [name, setName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [description, setDescription] = useState('');
  const [startClaude, setStartClaude] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available projects for dropdown
  const [projects, setProjects] = useState<Array<{ project_path: string; project_name: string }>>([]);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await window.electronAPI.getDistinctProjects();
        setProjects(data);
        // Set default project if available
        if (data.length > 0 && !projectPath) {
          setProjectPath(data[0].project_path);
          // Auto-suggest name from project
          suggestName(data[0].project_path);
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    };
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  // Auto-suggest workspace name from project path
  const suggestName = (path: string) => {
    if (name) return; // Don't overwrite if user has entered a name
    const basename = path.split('/').pop() || '';
    // Generate a simple default name
    setName(basename.replace(/-/g, ' ').split(' ').slice(0, 3).join('-').toLowerCase());
  };

  const handleProjectChange = (path: string) => {
    setProjectPath(path);
    suggestName(path);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !projectPath) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onCreate({
        name: name.trim(),
        projectPath,
        description: description.trim() || undefined,
        startClaude,
      });

      if (result.success) {
        // Reset form
        setName('');
        setDescription('');
        setStartClaude(true);
        onClose();
      } else {
        setError(result.error || 'Failed to create workspace');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-gradient">New Workspace</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <svg
              className="w-5 h-5 text-[var(--text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Workspace Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., stripe-integration"
              className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
              autoFocus
            />
          </div>

          {/* Project */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Project
            </label>
            <select
              value={projectPath}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            >
              {projects.map((project) => (
                <option key={project.project_path} value={project.project_path}>
                  {project.project_name || project.project_path.split('/').pop()}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-[var(--text-muted)] truncate">
              {projectPath}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what you're working on..."
              rows={2}
              className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors resize-none"
            />
          </div>

          {/* Start Claude checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="startClaude"
              checked={startClaude}
              onChange={(e) => setStartClaude(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] focus:ring-offset-0"
            />
            <label
              htmlFor="startClaude"
              className="text-sm text-[var(--text-secondary)]"
            >
              Start Claude session immediately
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="p-2 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/30">
              <p className="text-xs text-[var(--error)]">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !projectPath || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg hover:shadow-lg hover:glow-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
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
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
