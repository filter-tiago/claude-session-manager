import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { WorkspaceCard } from '../components/WorkspaceCard';
import { NewWorkspaceDialog } from '../components/modals/NewWorkspaceDialog';
import { useToast } from '../hooks/useToast';

type FilterTab = 'active' | 'completed' | 'all';

export function WorkspacesPage() {
  const navigate = useNavigate();
  const {
    filteredWorkspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    selectedWorkspaceSessions,
    sessionsLoading,
    filterStatus,
    isLoading,
    setSelectedWorkspace,
    setFilterStatus,
    createWorkspace,
    completeWorkspace,
    attachWorkspace,
    restoreWorkspace,
    deleteWorkspace,
    loadWorkspaces,
  } = useWorkspaces();

  const { success: showSuccess, error: showError } = useToast();
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  const handleCreate = useCallback(async (options: Parameters<typeof createWorkspace>[0]) => {
    const result = await createWorkspace(options);
    if (result.success) {
      showSuccess('Workspace created successfully');
    } else {
      showError(result.error || 'Failed to create workspace');
    }
    return result;
  }, [createWorkspace, showSuccess, showError]);

  const handleComplete = useCallback(async (workspaceId: number) => {
    const result = await completeWorkspace(workspaceId, { killTmux: false });
    if (result.success) {
      showSuccess(`Workspace completed: ${result.stats?.sessions || 0} sessions, ${result.stats?.messages || 0} messages`);
    } else {
      showError(result.error || 'Failed to complete workspace');
    }
  }, [completeWorkspace, showSuccess, showError]);

  const handleAttach = useCallback(async (workspaceId: number) => {
    const result = await attachWorkspace(workspaceId);
    if (!result.success) {
      showError(result.error || 'Failed to attach to workspace');
    }
  }, [attachWorkspace, showError]);

  const handleRestore = useCallback(async (workspaceId: number) => {
    const result = await restoreWorkspace(workspaceId);
    if (result.success) {
      showSuccess('Workspace tmux session restored');
    } else {
      showError(result.error || 'Failed to restore workspace');
    }
  }, [restoreWorkspace, showSuccess, showError]);

  const handleDelete = useCallback(async (workspaceId: number) => {
    const result = await deleteWorkspace(workspaceId, { killTmux: true });
    if (result.success) {
      showSuccess('Workspace deleted');
    } else {
      showError(result.error || 'Failed to delete workspace');
    }
  }, [deleteWorkspace, showSuccess, showError]);

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title="Back to sessions"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gradient">Workspaces</h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Group related Claude sessions under named work contexts
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsNewDialogOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg hover:shadow-lg hover:glow-accent transition-colors"
          >
            New Workspace
          </button>
        </header>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-[var(--border)]">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterStatus === tab.id
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <div className="flex-1" />

          {/* Refresh button */}
          <button
            onClick={() => loadWorkspaces()}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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
        </div>

        {/* Workspaces grid */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="w-8 h-8 animate-spin text-[var(--accent-primary)]"
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
                <p className="text-sm text-[var(--text-muted)]">Loading workspaces...</p>
              </div>
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg
                className="w-16 h-16 text-[var(--text-muted)] mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">
                No workspaces yet
              </h3>
              <p className="text-sm text-[var(--text-muted)] max-w-md mb-4">
                Create a workspace to group related Claude sessions under a named context.
                Each workspace gets its own tmux session.
              </p>
              <button
                onClick={() => setIsNewDialogOpen(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg hover:shadow-lg hover:glow-accent transition-colors"
              >
                Create Your First Workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  workspace={workspace}
                  isSelected={workspace.id === selectedWorkspaceId}
                  onSelect={() => setSelectedWorkspace(workspace.id)}
                  onAttach={() => handleAttach(workspace.id)}
                  onComplete={() => handleComplete(workspace.id)}
                  onRestore={() => handleRestore(workspace.id)}
                  onDelete={() => handleDelete(workspace.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar - Selected workspace details */}
      {selectedWorkspace && (
        <aside className="w-80 border-l border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden flex flex-col">
          {/* Workspace header */}
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-[var(--text-primary)] truncate">
                {selectedWorkspace.name}
              </h3>
              <button
                onClick={() => setSelectedWorkspace(null)}
                className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
              selectedWorkspace.status === 'active'
                ? 'bg-[var(--success)]/20 text-[var(--success)]'
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                selectedWorkspace.status === 'active'
                  ? 'bg-[var(--success)]'
                  : 'bg-gray-500'
              }`} />
              {selectedWorkspace.status}
            </div>
            {selectedWorkspace.description && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {selectedWorkspace.description}
              </p>
            )}
          </div>

          {/* Workspace info */}
          <div className="p-4 border-b border-[var(--border)] space-y-3">
            <div>
              <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
                Project
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {selectedWorkspace.project_path}
              </p>
            </div>
            {selectedWorkspace.tmux_session && (
              <div>
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
                  tmux Session
                </p>
                <p className="text-xs font-mono text-[var(--accent-primary)]">
                  {selectedWorkspace.tmux_session}
                </p>
              </div>
            )}
            <div className="flex gap-4">
              <div>
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
                  Sessions
                </p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {selectedWorkspace.session_count}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
                  Messages
                </p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {selectedWorkspace.total_messages}
                </p>
              </div>
            </div>
          </div>

          {/* Linked sessions */}
          <div className="flex-1 overflow-auto p-4">
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Linked Sessions
            </h4>
            {sessionsLoading ? (
              <div className="flex justify-center py-4">
                <svg
                  className="w-5 h-5 animate-spin text-[var(--accent-primary)]"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            ) : selectedWorkspaceSessions.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">
                No sessions yet. Sessions created in this project after the workspace was created will appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedWorkspaceSessions.map((session) => (
                  <div
                    key={session.session_id}
                    className="p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          session.status === 'active'
                            ? 'bg-[var(--success)]'
                            : session.status === 'idle'
                              ? 'bg-[var(--warning)]'
                              : 'bg-gray-500'
                        }`}
                      />
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        {session.session_id.substring(0, 8)}
                      </span>
                    </div>
                    {session.detected_task && (
                      <p className="text-xs text-[var(--text-secondary)] truncate">
                        {session.detected_task}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)]">
                      <span>{session.message_count} msgs</span>
                      <span>•</span>
                      <span>{session.tool_call_count} tools</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-[var(--border)] space-y-2">
            {selectedWorkspace.status === 'active' ? (
              <>
                <button
                  onClick={() => handleAttach(selectedWorkspace.id)}
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/80 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Open in Terminal
                </button>
                <button
                  onClick={() => handleComplete(selectedWorkspace.id)}
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mark as Complete
                </button>
              </>
            ) : (
              <button
                onClick={() => handleRestore(selectedWorkspace.id)}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-[var(--warning)]/20 text-[var(--warning)] hover:bg-[var(--warning)]/30 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restore Session
              </button>
            )}
          </div>
        </aside>
      )}

      {/* New Workspace Dialog */}
      <NewWorkspaceDialog
        isOpen={isNewDialogOpen}
        onClose={() => setIsNewDialogOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
