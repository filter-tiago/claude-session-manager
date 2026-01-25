import { useEffect, useRef } from 'react';
import type { Session, SessionEvent } from '../types/electron';
import { MessageBlock, ThinkingBlock } from './MessageBlock';
import { ToolCallBlock } from './ToolCallBlock';

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

  // Auto-scroll to bottom when events change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

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

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-[var(--text-secondary)]">Loading conversation...</div>
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
          <div className="max-w-4xl mx-auto">
            {events.map(renderEvent)}
          </div>
        )}
      </div>

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
