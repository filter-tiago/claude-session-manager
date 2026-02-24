import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { TerminalTileHeader } from './TerminalTileHeader';
import 'xterm/css/xterm.css';

// Reuse the same theme from TerminalViewer
const terminalTheme = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: '#264f78',
  selectionForeground: '#ffffff',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39d353',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d364',
  brightWhite: '#f0f6fc',
};

interface MiniTerminalProps {
  paneId: string;           // unique key: "session:window.pane"
  tmuxSession: string;
  tmuxPane: string;         // "window.pane" format
  shouldConnect: boolean;   // pool's intent (connecting or connected)
  isPlaceholder?: boolean;
  snapshot?: string;         // static text when paused
  // 3D: Accept grid-level callbacks that take IDs, so TerminalGrid avoids N closures
  onRequestConnect: (paneId: string, tmuxSession: string, tmuxPane: string) => void;
  onRequestDisconnect: (paneId: string) => void;
  onConnectionEstablished?: (paneId: string) => void;
  onConnectionFailed?: (paneId: string) => void;
  onConnectionLost: (paneId: string) => void;
  onMaximize: (paneId: string, tmuxSession: string, tmuxPane: string) => void;
  onKill: (sessionName: string) => void;
}

export const MiniTerminal: React.FC<MiniTerminalProps> = memo(({
  paneId,
  tmuxSession,
  tmuxPane,
  shouldConnect,
  isPlaceholder,
  snapshot,
  onRequestConnect,
  onRequestDisconnect,
  onConnectionEstablished,
  onConnectionFailed,
  onConnectionLost,
  onMaximize,
  onKill,
}) => {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasError, setHasError] = useState(false);
  // Use ref to avoid stale closure in listeners
  const connectedRef = useRef(false);
  const isBlocked = Boolean(isPlaceholder);
  // Ref-ify callbacks to avoid effect dep instability
  const onConnectionLostRef = useRef(onConnectionLost);
  useEffect(() => { onConnectionLostRef.current = onConnectionLost; }, [onConnectionLost]);
  const onConnectionEstablishedRef = useRef(onConnectionEstablished);
  useEffect(() => { onConnectionEstablishedRef.current = onConnectionEstablished; }, [onConnectionEstablished]);
  const onConnectionFailedRef = useRef(onConnectionFailed);
  useEffect(() => { onConnectionFailedRef.current = onConnectionFailed; }, [onConnectionFailed]);

  // Initialize xterm.js
  useEffect(() => {
    if (!termRef.current) return;

    const terminal = new Terminal({
      theme: terminalTheme,
      fontSize: 10,
      lineHeight: 1.0,
      scrollback: 500,
      cursorBlink: true,
      disableStdin: false,
      fontFamily: '"SF Mono", Monaco, Menlo, "Courier New", monospace',
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(termRef.current);

    // Delay fit to allow layout to settle
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch { /* no-op */ }
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Handle user input when connected
  useEffect(() => {
    if (!terminalRef.current) return;
    const terminal = terminalRef.current;
    const dataDisposable = terminal.onData((data) => {
      if (!connectedRef.current) return;
      window.electronAPI.terminalInput(paneId, data);
    });

    return () => {
      dataDisposable.dispose();
    };
  }, [paneId]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      try { fitAddonRef.current?.fit(); } catch { /* no-op */ }
    };
    const observer = new ResizeObserver(handleResize);
    if (termRef.current) {
      observer.observe(termRef.current);
    }
    window.addEventListener('resize', handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Effect A — Output listener (mount-scoped, stable across connect/disconnect cycles)
  useEffect(() => {
    const unsubscribe = window.electronAPI.onTerminalOutput((sessionId: string, data: string) => {
      if (sessionId === paneId && terminalRef.current) {
        terminalRef.current.write(data);
        if (!connectedRef.current) {
          connectedRef.current = true;
          setIsConnected(true);
        }
      }
    });
    return unsubscribe;
  }, [paneId]);

  // Effect B — Exit listener (mount-scoped)
  useEffect(() => {
    const unsubscribe = window.electronAPI.onTerminalExit((sessionId: string) => {
      if (sessionId === paneId) {
        connectedRef.current = false;
        isConnectingRef.current = false;
        setIsConnected(false);
        onConnectionLostRef.current(paneId);
      }
    });
    return unsubscribe;
  }, [paneId]);

  const isConnectingRef = useRef(false);

  const startConnection = useCallback(() => {
    if (!terminalRef.current) return;
    if (connectedRef.current || isConnectingRef.current) return;
    isConnectingRef.current = true;

    const cols = terminalRef.current.cols || 80;
    const rows = terminalRef.current.rows || 24;

    window.electronAPI.terminalConnect(paneId, tmuxSession, tmuxPane, cols, rows)
      .then((result: { success: boolean; error?: string }) => {
        isConnectingRef.current = false;
        if (result.success) {
          connectedRef.current = true;
          setIsConnected(true);
          setHasError(false);
          terminalRef.current?.focus();
          onConnectionEstablishedRef.current?.(paneId);
        } else {
          connectedRef.current = false;
          setIsConnected(false);
          setHasError(true);
          onConnectionFailedRef.current?.(paneId);
        }
      })
      .catch(() => {
        isConnectingRef.current = false;
        connectedRef.current = false;
        setIsConnected(false);
        setHasError(true);
        onConnectionFailedRef.current?.(paneId);
      });
  }, [paneId, tmuxSession, tmuxPane]);

  // Effect C — Connect/disconnect (responds to shouldConnect prop)
  useEffect(() => {
    if (isBlocked) return;
    if (shouldConnect) {
      startConnection();
      return () => {
        // Reset local state only — pool.disconnect() manages PTY lifecycle
        connectedRef.current = false;
        isConnectingRef.current = false;
      };
    }
  }, [shouldConnect, isBlocked, startConnection]);

  // Effect D — Snapshot display (only when disconnected)
  useEffect(() => {
    if (!shouldConnect && snapshot && terminalRef.current) {
      terminalRef.current.clear();
      terminalRef.current.write(snapshot);
    }
  }, [shouldConnect, snapshot]);

  const displayState = isBlocked
    ? 'idle'
    : isConnected
      ? 'connected'
      : shouldConnect
        ? 'connecting'
        : hasError
          ? 'error'
          : 'idle';

  // 3D: Stable internal callbacks — MiniTerminal binds its own paneId/tmuxSession/tmuxPane
  const handleTogglePause = useCallback(() => {
    if (isBlocked) return;
    if (displayState === 'connected') {
      onRequestDisconnect(paneId);
    } else if (displayState === 'idle' || displayState === 'error') {
      onRequestConnect(paneId, tmuxSession, tmuxPane);
    }
    // 'connecting' state: button is disabled, no action
  }, [displayState, onRequestConnect, onRequestDisconnect, isBlocked, paneId, tmuxSession, tmuxPane]);

  const handleDoubleClick = useCallback(() => {
    onMaximize(paneId, tmuxSession, tmuxPane);
  }, [onMaximize, paneId, tmuxSession, tmuxPane]);

  // Stable wrappers for TerminalTileHeader (expects no-arg callbacks)
  const handleMaximizeHeader = useCallback(() => {
    onMaximize(paneId, tmuxSession, tmuxPane);
  }, [onMaximize, paneId, tmuxSession, tmuxPane]);

  const handleKillHeader = useCallback(() => {
    onKill(tmuxSession);
  }, [onKill, tmuxSession]);

  const handleConnectButton = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRequestConnect(paneId, tmuxSession, tmuxPane);
  }, [onRequestConnect, paneId, tmuxSession, tmuxPane]);

  return (
    <div
      className="mini-terminal"
      onDoubleClick={handleDoubleClick}
      onClick={() => {
        if (displayState === 'connected') {
          terminalRef.current?.focus();
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1px solid rgba(48, 54, 61, 0.6)',
        background: 'rgba(13, 17, 23, 0.9)',
        minHeight: '200px',
        position: 'relative',
      }}
    >
      <TerminalTileHeader
        sessionName={tmuxSession}
        paneId={tmuxPane}
        connectionState={displayState}
        isPlaceholder={isPlaceholder}
        onMaximize={handleMaximizeHeader}
        onTogglePause={handleTogglePause}
        onKill={handleKillHeader}
      />
      <div
        ref={termRef}
        style={{
          flex: 1,
          padding: '4px',
          minHeight: '172px',
          position: 'relative',
        }}
      />
      {displayState === 'connecting' && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0, top: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(13, 17, 23, 0.7)',
          color: '#8b949e',
          fontSize: '12px',
        }}>
          Connecting...
        </div>
      )}
      {isPlaceholder && displayState !== 'connecting' && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0, top: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(13, 17, 23, 0.7)',
          color: '#8b949e',
          fontSize: '12px',
        }}>
          Waiting for pane data...
        </div>
      )}
      {displayState === 'error' && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0, top: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(13, 17, 23, 0.7)',
          color: '#ff7b72',
          fontSize: '12px',
        }}>
          Failed to connect
        </div>
      )}
      {displayState === 'idle' && snapshot && !isPlaceholder && (
        <div style={{
          position: 'absolute',
          bottom: 8, right: 8,
        }}>
          <button
            onClick={handleConnectButton}
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#10b981',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Connect
          </button>
        </div>
      )}
    </div>
  );
});
