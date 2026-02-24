import { useEffect, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Session, SessionEvent } from '../types/electron';
import { MessageBlock, ThinkingBlock } from './MessageBlock';
import { ToolCallBlock } from './ToolCallBlock';
import { MessageInput } from './MessageInput';
import { TerminalViewer } from './TerminalViewer';
import { MessageSkeleton } from './ui';

type ViewMode = 'terminal' | 'history';

interface ConversationViewerProps {
  session: Session;
  events: SessionEvent[];
  isLoading: boolean;
  onClose: () => void;
}

/**
 * Full conversation history with:
 * - User messages
 * - Assistant text responses
 * - Tool calls (collapsible)
 * - Thinking blocks (collapsed by default)
 */
export function ConversationViewer({
  session,
  events,
  isLoading,
  onClose,
}: ConversationViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isOpeningExternal, setIsOpeningExternal] = useState(false);

  // View mode: terminal (default for active sessions) or history
  const hasTmuxMapping = Boolean(session.tmux_session && session.tmux_pane);
  const canShowTerminal = hasTmuxMapping && session.status === 'active';
  const [viewMode, setViewMode] = useState<ViewMode>(
    canShowTerminal ? 'terminal' : 'history'
  );

  // Update view mode when session changes
  useEffect(() => {
    if (canShowTerminal && viewMode === 'history') {
      // Keep history view if user explicitly chose it
    } else if (!canShowTerminal && viewMode === 'terminal') {
      setViewMode('history');
    }
  }, [canShowTerminal, viewMode]);

  // Track whether user is near the bottom for auto-scroll
  const isNearBottomRef = useRef(true);
  const prevEventCountRef = useRef(events.length);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      isNearBottomRef.current = scrollTop + clientHeight >= scrollHeight - 100;
    }
  }, []);

  // Virtualizer for event list
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  // Auto-scroll to bottom when new events arrive, but only if user was near bottom
  useEffect(() => {
    if (events.length > prevEventCountRef.current && isNearBottomRef.current) {
      virtualizer.scrollToIndex(events.length - 1, { align: 'end' });
    }
    prevEventCountRef.current = events.length;
  }, [events.length, virtualizer]);

  // Handle opening session in external terminal
  const handleOpenExternal = useCallback(async () => {
    setIsOpeningExternal(true);
    try {
      const result = await window.electronAPI.openSessionTerminal(session);
      if (!result.success) {
        setSendError(result.error || 'Failed to open in terminal');
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Failed to open in terminal');
    } finally {
      setIsOpeningExternal(false);
    }
  }, [session]);

  // Handle sending messages to the session's tmux pane
  const handleSendMessage = useCallback(async (message: string) => {
    if (!session.session_id) return;

    setIsSending(true);
    setSendError(null);

    try {
      const result = await window.electronAPI.sendToPane(session.session_id, message);
      if (!result.success) {
        setSendError(result.error || 'Failed to send message');
        throw new Error(result.error || 'Failed to send message');
      }

      // Clear any previous error on success
      setSendError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setSendError(errorMessage);
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [session.session_id]);

  const getStatusBadge = (status: Session['status']) => {
    const colors = {
      active: 'bg-[var(--success)] text-white',
      idle: 'bg-[var(--warning)] text-black',
      completed: 'bg-gray-500 text-white',
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
        {status}
      </span>
    );
  };

  const formatDuration = () => {
    const start = new Date(session.started_at);
    const end = new Date(session.last_activity);
    const diff = end.getTime() - start.getTime();

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const renderEvent = (event: SessionEvent) => {
    const key = `${event.id}-${event.timestamp}`;

    switch (event.event_type) {
      case 'user_message':
        return (
          <MessageBlock
            key={key}
            role="user"
            content={event.content || ''}
            timestamp={event.timestamp}
          />
        );

      case 'assistant_message':
        return (
          <MessageBlock
            key={key}
            role="assistant"
            content={event.content || ''}
            timestamp={event.timestamp}
          />
        );

      case 'thinking':
        return (
          <ThinkingBlock
            key={key}
            content={event.content || ''}
            timestamp={event.timestamp}
          />
        );

      case 'tool_call':
        return (
          <ToolCallBlock
            key={key}
            toolName={event.tool_name || 'Unknown Tool'}
            input={event.tool_input}
            output={event.tool_output}
            filesTouched={event.files_touched}
            timestamp={event.timestamp}
          />
        );

      default:
        // For unknown event types, show a generic card
        return (
          <div
            key={key}
            className="mb-4 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]"
          >
            <div className="text-xs text-[var(--text-secondary)] mb-1">
              {event.event_type}
            </div>
            {event.content && (
              <div className="text-sm whitespace-pre-wrap">{event.content}</div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-semibold truncate">
                {session.name || session.project_name}
              </h2>
              {getStatusBadge(session.status)}
            </div>

            {/* tmux location */}
            {session.tmux_session && session.tmux_pane && (
              <div className="mb-2">
                <span className="text-sm font-mono px-2 py-1 bg-[var(--bg-primary)] rounded">
                  {session.tmux_session}:{session.tmux_pane}
                </span>
              </div>
            )}

            {/* Detected task */}
            {session.detected_task && (
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                {session.detected_task}
              </p>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-secondary)]">
              <span>{session.message_count} messages</span>
              <span>{session.tool_call_count} tool calls</span>
              <span>{formatDuration()}</span>
              {session.detected_area && (
                <span className="px-2 py-0.5 bg-[var(--accent-secondary)] rounded-full text-xs">
                  {session.detected_area}
                </span>
              )}
              {session.git_branch && (
                <span className="font-mono text-xs">{session.git_branch}</span>
              )}
            </div>

            {/* View mode toggle and external terminal button */}
            {hasTmuxMapping && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1 p-1 bg-[var(--bg-primary)] rounded-lg">
                  <button
                    onClick={() => setViewMode('terminal')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                      viewMode === 'terminal'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    disabled={!canShowTerminal}
                    title={!canShowTerminal ? 'Terminal requires active session' : undefined}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Terminal
                  </button>
                  <button
                    onClick={() => setViewMode('history')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                      viewMode === 'history'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    History
                  </button>
                </div>
                <button
                  onClick={handleOpenExternal}
                  disabled={isOpeningExternal}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 bg-[var(--bg-tertiary)] ${
                    isOpeningExternal
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-[var(--accent-primary)] hover:text-white'
                  }`}
                  title="Open session in external terminal app"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {isOpeningExternal ? 'Opening...' : 'Open Externally'}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            title="Close"
          >
            <svg
              className="w-5 h-5 text-[var(--text-secondary)]"
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
      </div>

      {/* Main content - Terminal or History */}
      {viewMode === 'terminal' && canShowTerminal ? (
        <TerminalViewer
          sessionId={session.session_id}
          tmuxSession={session.tmux_session!}
          tmuxPane={session.tmux_pane!}
          isActive={session.status === 'active'}
          onDisconnected={() => setViewMode('history')}
        />
      ) : (
        <>
          {/* Conversation History */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4"
            onScroll={handleScroll}
          >
            {isLoading ? (
              <div className="max-w-4xl mx-auto space-y-4">
                <MessageSkeleton isAssistant={false} />
                <MessageSkeleton isAssistant={true} />
                <MessageSkeleton isAssistant={false} />
                <MessageSkeleton isAssistant={true} />
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <svg
                  className="w-12 h-12 text-[var(--text-secondary)] mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <h3 className="text-lg font-medium mb-1">No events yet</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Conversation events will appear here as they're indexed.
                </p>
              </div>
            ) : (
              <div
                className="max-w-4xl mx-auto"
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderEvent(events[virtualRow.index])}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message Input - only shown in history view */}
          <MessageInput
            sessionId={session.session_id}
            isActive={session.status === 'active'}
            onSend={handleSendMessage}
            isLoading={isSending}
          />
        </>
      )}

      {/* Error toast */}
      {sendError && (
        <div className="absolute bottom-24 left-4 right-4 mx-auto max-w-md p-3 bg-red-900/90 text-red-100 rounded-lg shadow-lg flex items-center gap-2">
          <svg
            className="w-5 h-5 flex-shrink-0"
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
          <span className="flex-1 text-sm">{sendError}</span>
          <button
            onClick={() => setSendError(null)}
            className="p-1 hover:bg-red-800 rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Footer with session path */}
      <div className="flex-shrink-0 px-4 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span className="font-mono truncate">{session.project_path}</span>
          <span>
            Started {new Date(session.started_at).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
