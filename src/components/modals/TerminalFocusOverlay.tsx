import React, { useEffect, useCallback } from 'react';
import { TerminalViewer } from '../TerminalViewer';

interface TerminalFocusOverlayProps {
  paneId: string;
  tmuxSession: string;
  tmuxPane: string;
  onClose: () => void;
}

export const TerminalFocusOverlay: React.FC<TerminalFocusOverlayProps> = ({
  paneId,
  tmuxSession,
  tmuxPane,
  onClose,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  return (
    <div
      className="terminal-focus-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(1, 4, 9, 0.85)',
        backdropFilter: 'blur(8px)',
        animation: 'overlay-scale-in 0.15s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '40px',
          padding: '0 16px',
          background: 'rgba(22, 27, 34, 0.95)',
          borderBottom: '1px solid rgba(48, 54, 61, 0.6)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#3fb950',
            }}
          />
          <span
            style={{
              color: '#e6edf3',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            {tmuxSession}
          </span>
          <span style={{ color: '#8b949e', fontSize: '12px' }}>
            pane {tmuxPane}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title="Close (Escape)"
        >
          <span style={{ fontSize: '11px', opacity: 0.7 }}>ESC</span>
          <span>✕</span>
        </button>
      </div>

      {/* Terminal viewer - full size */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <TerminalViewer
          sessionId={paneId}
          tmuxSession={tmuxSession}
          tmuxPane={tmuxPane}
          isActive={true}
        />
      </div>
    </div>
  );
};
