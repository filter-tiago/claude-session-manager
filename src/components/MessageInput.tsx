import { useState, useRef, useEffect, useCallback } from 'react';

interface MessageInputProps {
  sessionId: string;
  isActive: boolean;
  onSend: (message: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * Message input component for sending prompts to active Claude sessions.
 * Features:
 * - Auto-resize textarea (min 1 line, max 8 lines)
 * - Send button (disabled when empty or loading)
 * - Keyboard: Enter to send, Shift+Enter for newline
 * - Loading state with spinner
 * - Disabled state for non-active sessions
 */
export function MessageInput({
  sessionId,
  isActive,
  onSend,
  isLoading,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate new height (min 1 line ~40px, max 8 lines ~200px)
    const lineHeight = 24;
    const minHeight = lineHeight + 16; // 1 line + padding
    const maxHeight = lineHeight * 8 + 16; // 8 lines + padding

    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, []);

  // Adjust height when message changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  // Focus textarea when session becomes active
  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [sessionId, isActive]);

  const handleSubmit = async () => {
    if (!message.trim() || isLoading || !isActive) return;

    try {
      await onSend(message.trim());
      setMessage('');
      // Reset textarea height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = message.trim().length > 0 && !isLoading && isActive;

  return (
    <div className="flex-shrink-0 p-4 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      {/* Disabled message for non-active sessions */}
      {!isActive && (
        <div className="mb-2 text-xs text-[var(--text-secondary)] flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>Session is not active. Messages can only be sent to active sessions.</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isActive ? 'Send a message...' : 'Session not active'}
            disabled={!isActive || isLoading}
            className={`
              w-full px-4 py-2 rounded-lg resize-none
              bg-[var(--bg-tertiary)] border border-[var(--border)]
              text-[var(--text-primary)] placeholder-[var(--text-secondary)]
              focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            `}
            style={{ minHeight: '40px', maxHeight: '200px' }}
            rows={1}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={`
            flex-shrink-0 px-4 py-2 rounded-lg font-medium
            flex items-center justify-center gap-2
            transition-colors
            ${canSend
              ? 'bg-[var(--accent-primary)] text-white hover:opacity-90 cursor-pointer'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed'
            }
          `}
          title={!isActive ? 'Session not active' : isLoading ? 'Sending...' : 'Send message (Enter)'}
        >
          {isLoading ? (
            <>
              {/* Spinner */}
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
              <span>Sending</span>
            </>
          ) : (
            <>
              {/* Send icon */}
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
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              <span className="hidden sm:inline">Send</span>
            </>
          )}
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="mt-2 text-xs text-[var(--text-secondary)]">
        <span className="font-mono bg-[var(--bg-tertiary)] px-1 py-0.5 rounded">Enter</span>
        {' to send, '}
        <span className="font-mono bg-[var(--bg-tertiary)] px-1 py-0.5 rounded">Shift+Enter</span>
        {' for new line'}
      </div>
    </div>
  );
}
