import React from 'react';
import { MiniTerminal } from './MiniTerminal';

interface TmuxSessionInfo {
  name: string;
  windows: number;
  panes: number;
  created: string;
  attached: boolean;
  lastActivity: string;
  size: string;
  claudeSessions: string[];
}

interface PaneInfo {
  paneId: string;        // "session:window.pane"
  tmuxSession: string;
  tmuxPane: string;      // "window.pane"
  isConnected: boolean;
  isPlaceholder?: boolean;
  snapshot?: string;
}

interface TerminalGridProps {
  sessions: TmuxSessionInfo[];
  panes: PaneInfo[];
  loading?: boolean;
  columns: number;
  connectedPaneIds: Set<string>;
  connectingPaneIds: Set<string>;
  snapshots: Map<string, string>;
  onRequestConnect: (paneId: string, tmuxSession: string, tmuxPane: string) => void;
  onRequestDisconnect: (paneId: string) => void;
  onConnectionEstablished: (paneId: string) => void;
  onConnectionFailed: (paneId: string) => void;
  onConnectionLost: (paneId: string) => void;
  onMaximize: (paneId: string, tmuxSession: string, tmuxPane: string) => void;
  onKill: (sessionName: string) => void;
}

export const TerminalGrid: React.FC<TerminalGridProps> = ({
  panes,
  loading,
  columns,
  connectedPaneIds,
  connectingPaneIds,
  snapshots,
  onRequestConnect,
  onRequestDisconnect,
  onConnectionEstablished,
  onConnectionFailed,
  onConnectionLost,
  onMaximize,
  onKill,
}) => {
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '300px',
        color: '#8b949e',
        fontSize: '14px',
      }}>
        Loading tmux panes...
      </div>
    );
  }

  if (panes.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '300px',
        color: '#8b949e',
        fontSize: '14px',
      }}>
        No tmux panes found
      </div>
    );
  }

  return (
    <div
      className="terminal-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '4px',
        padding: '4px',
      }}
    >
      {/* 3D: Pass grid-level callbacks directly — MiniTerminal creates stable internal callbacks */}
      {panes.map((pane) => (
        <MiniTerminal
          key={pane.paneId}
          paneId={pane.paneId}
          tmuxSession={pane.tmuxSession}
          tmuxPane={pane.tmuxPane}
          shouldConnect={!pane.isPlaceholder && (connectedPaneIds.has(pane.paneId) || connectingPaneIds.has(pane.paneId))}
          isPlaceholder={pane.isPlaceholder}
          snapshot={snapshots.get(pane.paneId)}
          onRequestConnect={onRequestConnect}
          onRequestDisconnect={onRequestDisconnect}
          onConnectionEstablished={onConnectionEstablished}
          onConnectionFailed={onConnectionFailed}
          onConnectionLost={onConnectionLost}
          onMaximize={onMaximize}
          onKill={onKill}
        />
      ))}
    </div>
  );
};
