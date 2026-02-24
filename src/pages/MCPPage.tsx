import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MCPServerStatus, MCPTestResult, MCPTool } from '../types/electron';

interface TestResultModalProps {
  isOpen: boolean;
  serverName: string;
  result: MCPTestResult | null;
  onClose: () => void;
}

function TestResultModal({ isOpen, serverName, result, onClose }: TestResultModalProps) {
  if (!isOpen || !result) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                result.success ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Test: {serverName}
            </h2>
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
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Status */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'Connection Successful' : 'Connection Failed'}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {result.durationMs}ms
              </span>
            </div>
            {result.error && (
              <div className="text-sm text-red-400 bg-red-950/30 px-3 py-2 rounded">
                {result.error}
              </div>
            )}
          </div>

          {/* Server Info */}
          {result.serverInfo && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Server Info</h3>
              <div className="bg-[var(--bg-tertiary)] rounded px-3 py-2 text-sm">
                <span className="text-[var(--text-primary)]">{result.serverInfo.name || 'Unknown'}</span>
                {result.serverInfo.version && (
                  <span className="text-[var(--text-muted)] ml-2">v{result.serverInfo.version}</span>
                )}
              </div>
            </div>
          )}

          {/* Tools */}
          {result.tools && result.tools.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">
                Available Tools ({result.tools.length})
              </h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {result.tools.map((tool: MCPTool, i: number) => (
                  <div
                    key={i}
                    className="bg-[var(--bg-tertiary)] rounded px-3 py-2"
                  >
                    <div className="text-sm font-mono text-[var(--text-primary)]">{tool.name}</div>
                    {tool.description && (
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                        {tool.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.success && (!result.tools || result.tools.length === 0) && (
            <div className="text-sm text-[var(--text-secondary)]">
              No tools registered on this server.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, command: string, args?: string[]) => Promise<void>;
}

function AddServerModal({ isOpen, onClose, onAdd }: AddServerModalProps) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !command.trim()) {
      setError('Name and command are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const argsArray = args.trim()
        ? args.split(/\s+/).filter(Boolean)
        : undefined;
      await onAdd(name.trim(), command.trim(), argsArray);
      setName('');
      setCommand('');
      setArgs('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add server');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Add MCP Server</h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Server Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-server"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Command</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npx -y @modelcontextprotocol/server-xyz"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              Arguments <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="--port 3000 --config file.json"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/30 px-3 py-2 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !command.trim()}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding...' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ServerCardProps {
  server: MCPServerStatus;
  onTest: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isTesting: boolean;
}

function ServerCard({ server, onTest, onToggle, onDelete, isTesting }: ServerCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Name and status */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-2 h-2 rounded-full ${
                server.disabled
                  ? 'bg-gray-500'
                  : server.status === 'running'
                  ? 'bg-green-500'
                  : server.status === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-500'
              }`}
            />
            <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
              {server.name}
            </h3>
            {server.disabled && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                Disabled
              </span>
            )}
          </div>

          {/* Command */}
          <div className="text-xs font-mono text-[var(--text-secondary)] truncate mb-2">
            {server.command}
            {server.args && server.args.length > 0 && (
              <span className="text-[var(--text-muted)]">
                {' '}{server.args.join(' ')}
              </span>
            )}
          </div>

          {/* Tool count if known */}
          {server.toolCount !== undefined && (
            <div className="text-xs text-[var(--text-muted)]">
              {server.toolCount} tool{server.toolCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {/* Toggle switch */}
          <button
            onClick={onToggle}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              server.disabled ? 'bg-gray-600' : 'bg-green-600'
            }`}
            title={server.disabled ? 'Enable' : 'Disable'}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                server.disabled ? 'left-0.5' : 'left-5'
              }`}
            />
          </button>

          {/* Test button */}
          <button
            onClick={onTest}
            disabled={isTesting || server.disabled}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Test connection"
          >
            {isTesting ? (
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
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </button>

          {/* Delete button */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-[var(--text-secondary)] hover:text-red-400 hover:bg-[var(--bg-tertiary)] rounded"
              title="Delete server"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MCPPage() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<MCPServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingServer, setTestingServer] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ name: string; result: MCPTestResult } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadServers = useCallback(async () => {
    try {
      const statuses = await window.electronAPI.getMcpServerStatuses();
      setServers(statuses);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();

    // Listen for config changes
    const unsubscribe = window.electronAPI.onSettingsChanged((event) => {
      if (event.type === 'mcp') {
        loadServers();
      }
    });

    return unsubscribe;
  }, [loadServers]);

  const handleTest = async (serverName: string) => {
    setTestingServer(serverName);
    try {
      const result = await window.electronAPI.testMcpServer(serverName);
      setTestResult({ name: serverName, result });
    } catch (error) {
      setTestResult({
        name: serverName,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs: 0,
        },
      });
    } finally {
      setTestingServer(null);
    }
  };

  const handleToggle = async (serverName: string, currentlyDisabled: boolean | undefined) => {
    try {
      await window.electronAPI.toggleMcpServer(serverName, !!currentlyDisabled);
      await loadServers();
    } catch (error) {
      console.error('Failed to toggle server:', error);
    }
  };

  const handleDelete = async (serverName: string) => {
    try {
      await window.electronAPI.removeMcpServer(serverName);
      await loadServers();
    } catch (error) {
      console.error('Failed to delete server:', error);
    }
  };

  const handleAdd = async (name: string, command: string, args?: string[]) => {
    await window.electronAPI.addMcpServer(name, command, args);
    await loadServers();
  };

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
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">MCP Servers</h1>
          <span className="ml-2 px-1.5 py-0.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">
            {servers.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadServers}
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
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Server
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 animate-pulse"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--bg-tertiary)]" />
                  <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded" />
                </div>
                <div className="h-3 w-48 bg-[var(--bg-tertiary)] rounded" />
              </div>
            ))}
          </div>
        ) : servers.length === 0 ? (
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
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">No MCP Servers</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mb-4">
              Add MCP servers to extend Claude's capabilities with custom tools.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Your First Server
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {servers.map((server) => (
              <ServerCard
                key={server.name}
                server={server}
                onTest={() => handleTest(server.name)}
                onToggle={() => handleToggle(server.name, server.disabled)}
                onDelete={() => handleDelete(server.name)}
                isTesting={testingServer === server.name}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <TestResultModal
        isOpen={testResult !== null}
        serverName={testResult?.name || ''}
        result={testResult?.result || null}
        onClose={() => setTestResult(null)}
      />

      <AddServerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />
    </div>
  );
}
