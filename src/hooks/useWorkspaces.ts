import { useCallback, useEffect, useMemo } from 'react';
import { useWorkspaceStore, useFilteredWorkspaces } from '../stores/workspaceStore';
import type { CreateWorkspaceOptions } from '../types/electron';

export function useWorkspaces() {
  // Granular state selectors
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const filterStatus = useWorkspaceStore((s) => s.filterStatus);
  const isLoading = useWorkspaceStore((s) => s.isLoading);
  const error = useWorkspaceStore((s) => s.error);
  const selectedWorkspaceSessions = useWorkspaceStore((s) => s.selectedWorkspaceSessions);
  const sessionsLoading = useWorkspaceStore((s) => s.sessionsLoading);

  // Actions — stable references from create()
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setSelectedWorkspace = useWorkspaceStore((s) => s.setSelectedWorkspace);
  const setFilterStatus = useWorkspaceStore((s) => s.setFilterStatus);
  const setLoading = useWorkspaceStore((s) => s.setLoading);
  const setError = useWorkspaceStore((s) => s.setError);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);
  const setSelectedWorkspaceSessions = useWorkspaceStore((s) => s.setSelectedWorkspaceSessions);
  const setSessionsLoading = useWorkspaceStore((s) => s.setSessionsLoading);

  // Memoized filtered workspaces from standalone selector
  const filteredWorkspaces = useFilteredWorkspaces();

  // Memoized selected workspace (1E)
  const selectedWorkspace = useMemo(
    () => selectedWorkspaceId ? workspaces.find((w) => w.id === selectedWorkspaceId) ?? null : null,
    [selectedWorkspaceId, workspaces]
  );

  // Load workspaces on mount
  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get status filter for API (null for 'all')
      const statusFilter = filterStatus === 'all' ? undefined : filterStatus;
      const data = await window.electronAPI.getWorkspaces(
        statusFilter ? { status: statusFilter } : undefined
      );
      setWorkspaces(data);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, setWorkspaces, setLoading, setError]);

  // Load on mount and when filter changes
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Load sessions for selected workspace
  const loadWorkspaceSessions = useCallback(async (workspaceId: number) => {
    setSessionsLoading(true);

    try {
      const sessions = await window.electronAPI.getWorkspaceSessions(workspaceId);
      setSelectedWorkspaceSessions(sessions);
    } catch (err) {
      console.error('Failed to load workspace sessions:', err);
      setSelectedWorkspaceSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [setSelectedWorkspaceSessions, setSessionsLoading]);

  // Load sessions when selected workspace changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      loadWorkspaceSessions(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId, loadWorkspaceSessions]);

  // Create workspace
  const createWorkspace = useCallback(async (
    options: CreateWorkspaceOptions
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await window.electronAPI.createWorkspace(options);

      if (result.success && result.workspace) {
        // Reload workspaces to get stats
        await loadWorkspaces();
        return { success: true };
      }

      return { success: false, error: result.error };
    } catch (err) {
      console.error('Failed to create workspace:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create workspace',
      };
    }
  }, [loadWorkspaces]);

  // Complete workspace
  const completeWorkspace = useCallback(async (
    workspaceId: number,
    options?: { killTmux?: boolean }
  ): Promise<{ success: boolean; stats?: { sessions: number; messages: number }; error?: string }> => {
    try {
      const result = await window.electronAPI.completeWorkspace(workspaceId, options);

      if (result.success) {
        // Update local state
        const workspace = workspaces.find((w) => w.id === workspaceId);
        if (workspace) {
          updateWorkspace({
            ...workspace,
            status: 'completed',
            completed_at: new Date().toISOString(),
          });
        }
      }

      return result;
    } catch (err) {
      console.error('Failed to complete workspace:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to complete workspace',
      };
    }
  }, [workspaces, updateWorkspace]);

  // Attach to workspace
  const attachWorkspace = useCallback(async (
    workspaceId: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      return await window.electronAPI.attachWorkspace(workspaceId);
    } catch (err) {
      console.error('Failed to attach to workspace:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to attach to workspace',
      };
    }
  }, []);

  // Restore workspace
  const restoreWorkspace = useCallback(async (
    workspaceId: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      return await window.electronAPI.restoreWorkspace(workspaceId);
    } catch (err) {
      console.error('Failed to restore workspace:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to restore workspace',
      };
    }
  }, []);

  // Delete workspace
  const deleteWorkspace = useCallback(async (
    workspaceId: number,
    options?: { killTmux?: boolean }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await window.electronAPI.deleteWorkspace(workspaceId, options);

      if (result.success) {
        removeWorkspace(workspaceId);
      }

      return result;
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete workspace',
      };
    }
  }, [removeWorkspace]);

  return {
    // State
    workspaces,
    filteredWorkspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    filterStatus,
    isLoading,
    error,
    selectedWorkspaceSessions,
    sessionsLoading,

    // Actions
    loadWorkspaces,
    setSelectedWorkspace,
    setFilterStatus,
    createWorkspace,
    completeWorkspace,
    attachWorkspace,
    restoreWorkspace,
    deleteWorkspace,
  };
}
