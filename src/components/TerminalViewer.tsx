import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface TerminalViewerProps {
  sessionId: string;
  tmuxSession: string;
  tmuxPane: string;
  isActive: boolean;
  onDisconnected?: () => void;
}

// xterm.js theme matching GitHub dark
const terminalTheme = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: 'rgba(88, 166, 255, 0.3)',
  selectionForeground: '#c9d1d9',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc',
};

/**
 * Embedded terminal viewer using xterm.js
 * Connects to a tmux pane via the PTY manager
 */
export function TerminalViewer({
  sessionId,
  tmuxSession,
  tmuxPane,
  isActive,
  onDisconnected,
}: TerminalViewerProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Clean up terminal instance
  const cleanup = useCallback(() => {
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }
    fitAddonRef.current = null;
  }, []);

  // Connect to the terminal
  const connect = useCallback(async () => {
    if (!terminalRef.current || isConnecting || isConnected) return;

    setIsConnecting(true);
    setConnectionError(null);

    // Create terminal instance
    const term = new Terminal({
      theme: terminalTheme,
      fontFamily: '"SF Mono", "Monaco", "Menlo", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      allowProposedApi: true,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Open terminal in the container
    term.open(terminalRef.current);

    // Fit to container
    fitAddon.fit();

    // Store refs
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Get terminal dimensions
    const { cols, rows } = term;

    try {
      // Connect to the tmux pane
      const result = await window.electronAPI.terminalConnect(
        sessionId,
        tmuxSession,
        tmuxPane,
        cols,
        rows
      );

      if (!result.success) {
        setConnectionError(result.error || 'Failed to connect');
        cleanup();
        return;
      }

      setIsConnected(true);
      term.focus();
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : 'Connection failed'
      );
      cleanup();
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId, tmuxSession, tmuxPane, isConnecting, isConnected, cleanup]);

  // Disconnect from the terminal
  const disconnect = useCallback(async () => {
    if (!isConnected) return;

    try {
      await window.electronAPI.terminalDisconnect(sessionId);
    } catch (error) {
      console.error('Error disconnecting terminal:', error);
    }

    setIsConnected(false);
    cleanup();
    onDisconnected?.();
  }, [sessionId, isConnected, cleanup, onDisconnected]);

  // Register terminal output listener FIRST, before connection starts
  // This prevents the race condition where initial output is lost
  useEffect(() => {
    const unsubscribe = window.electronAPI.onTerminalOutput(
      (recvSessionId, data) => {
        if (recvSessionId === sessionId && termRef.current) {
          termRef.current.write(data);
        }
      }
    );

    return unsubscribe;
  }, [sessionId]);  // No isConnected dependency - register immediately

  // Initialize terminal on mount (after listener is registered)
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []);  // Only run on mount/unmount

  // Handle terminal exit
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = window.electronAPI.onTerminalExit(
      (recvSessionId, exitCode) => {
        if (recvSessionId === sessionId) {
          console.log(`Terminal exited with code ${exitCode}`);
          setIsConnected(false);
          onDisconnected?.();
        }
      }
    );

    return unsubscribe;
  }, [sessionId, isConnected, onDisconnected]);

  // Handle keyboard input
  useEffect(() => {
    if (!isConnected || !termRef.current) return;

    const term = termRef.current;

    // Handle regular character input
    const dataDisposable = term.onData((data) => {
      window.electronAPI.terminalInput(sessionId, data);
    });

    return () => {
      dataDisposable.dispose();
    };
  }, [sessionId, isConnected]);

  // Handle window resize
  useEffect(() => {
    if (!isConnected || !fitAddonRef.current || !termRef.current) return;

    const handleResize = () => {
      const fitAddon = fitAddonRef.current;
      const term = termRef.current;
      if (fitAddon && term) {
        fitAddon.fit();
        const { cols, rows } = term;
        window.electronAPI.terminalResize(sessionId, cols, rows);
      }
    };

    // Debounce resize events
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);

    // Also use ResizeObserver for container size changes
    const container = terminalRef.current;
    let resizeObserver: ResizeObserver | null = null;

    if (container) {
      resizeObserver = new ResizeObserver(debouncedResize);
      resizeObserver.observe(container);
    }

    // Initial fit
    handleResize();

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', debouncedResize);
      resizeObserver?.disconnect();
    };
  }, [sessionId, isConnected]);

  // Render loading/error states
  if (isConnecting) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d1117]">
        <div className="text-[var(--text-secondary)] flex items-center gap-2">
          <svg
            className="w-5 h-5 animate-spin"
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
          Connecting to terminal...
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0d1117] gap-4">
        <div className="text-red-400 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {connectionError}
        </div>
        <button
          onClick={() => {
            setConnectionError(null);
            connect();
          }}
          className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg text-sm font-medium transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!isActive && !isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0d1117] gap-2">
        <svg
          className="w-12 h-12 text-[var(--text-secondary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-[var(--text-secondary)]">Session is not active</p>
        <p className="text-sm text-[var(--text-secondary)]">
          Terminal view is only available for active sessions with tmux mapping
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden">
      {/* Terminal container */}
      <div
        ref={terminalRef}
        className="flex-1 p-2"
        style={{ minHeight: 0 }}
      />

      {/* Status bar */}
      <div className="flex-shrink-0 px-3 py-1 bg-[var(--bg-tertiary)] border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
          <span>
            {tmuxSession}:{tmuxPane}
          </span>
        </div>
        {isConnected && (
          <button
            onClick={disconnect}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Disconnect"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
