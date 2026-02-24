import React from 'react';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

interface TerminalTileHeaderProps {
  sessionName: string;
  paneId: string;         // e.g. "0.0"
  connectionState: ConnectionState;
  isPlaceholder?: boolean;
  onMaximize: () => void;
  onTogglePause: () => void;
  onKill: () => void;
}

const dotColors: Record<ConnectionState, string> = {
  idle: '#484f58',
  connecting: '#d29922',
  connected: '#3fb950',
  error: '#ff7b72',
};

const buttonConfig: Record<ConnectionState, { label: string; color: string; borderColor: string; disabled: boolean; title: string }> = {
  idle: { label: 'Connect', color: '#3fb950', borderColor: 'rgba(63,185,80,0.3)', disabled: false, title: 'Connect live feed' },
  connecting: { label: '...', color: '#d29922', borderColor: 'rgba(210,153,34,0.3)', disabled: true, title: 'Connecting...' },
  connected: { label: 'Pause', color: '#d29922', borderColor: 'rgba(210,153,34,0.3)', disabled: false, title: 'Disconnect live feed' },
  error: { label: 'Retry', color: '#ff7b72', borderColor: 'rgba(255,123,114,0.3)', disabled: false, title: 'Retry connection' },
};

export const TerminalTileHeader: React.FC<TerminalTileHeaderProps> = ({
  sessionName, paneId, connectionState, isPlaceholder, onMaximize, onTogglePause, onKill
}) => {
  const dot = dotColors[connectionState];
  const btn = isPlaceholder
    ? {
      label: 'Waiting',
      color: '#8b949e',
      borderColor: 'rgba(139,148,158,0.3)',
      disabled: true,
      title: 'Waiting for tmux pane data',
    }
    : buttonConfig[connectionState];

  return (
    <div className="terminal-tile-header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '28px',
      padding: '0 8px',
      background: 'rgba(22, 27, 34, 0.9)',
      borderBottom: '1px solid rgba(48, 54, 61, 0.6)',
      fontSize: '11px',
      userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: dot,
          flexShrink: 0,
          ...(connectionState === 'connecting' ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
        }} />
        <span style={{ color: '#e6edf3', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {sessionName}
        </span>
        <span style={{ color: '#8b949e', flexShrink: 0 }}>{paneId}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onMaximize(); }}
          style={tileButtonStyle}
          title="Maximize"
        >
          ⤢
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePause(); }}
          disabled={btn.disabled}
          style={{
            ...tileButtonStyle,
            color: btn.color,
            fontSize: '10px',
            padding: '1px 5px',
            border: `1px solid ${btn.borderColor}`,
            opacity: btn.disabled ? 0.6 : 1,
            cursor: btn.disabled ? 'default' : 'pointer',
          }}
          title={btn.title}
        >
          {btn.label}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onKill(); }}
          style={{...tileButtonStyle, color: '#ff7b72'}}
          title="Kill session"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

const tileButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#8b949e',
  cursor: 'pointer',
  padding: '2px 4px',
  borderRadius: '3px',
  fontSize: '12px',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
