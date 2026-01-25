import { useState } from 'react';

interface MessageBlockProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/**
 * Render user/assistant messages with basic markdown-like formatting
 */
export function MessageBlock({ role, content, timestamp }: MessageBlockProps) {
  const isUser = role === 'user';

  // Simple markdown-like rendering
  const renderContent = (text: string) => {
    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      // Code block
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).split('\n');
        const language = lines[0] || '';
        const code = lines.slice(language ? 1 : 0).join('\n');

        return (
          <pre
            key={index}
            className="my-2 p-3 bg-[var(--bg-primary)] rounded-lg overflow-x-auto text-sm"
          >
            {language && (
              <div className="text-xs text-[var(--text-secondary)] mb-2 font-sans">
                {language}
              </div>
            )}
            <code className="font-mono text-[var(--text-primary)]">{code}</code>
          </pre>
        );
      }

      // Regular text - process inline formatting
      return (
        <div key={index} className="whitespace-pre-wrap">
          {processInlineFormatting(part)}
        </div>
      );
    });
  };

  const processInlineFormatting = (text: string) => {
    // Split by inline code
    const parts = text.split(/(`[^`]+`)/g);

    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-sm font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          isUser
            ? 'bg-[var(--accent-primary)] text-white'
            : 'bg-[var(--bg-secondary)] border border-[var(--border)]'
        }`}
      >
        {/* Role label */}
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-xs font-medium ${
              isUser ? 'text-white/80' : 'text-[var(--text-secondary)]'
            }`}
          >
            {isUser ? 'You' : 'Claude'}
          </span>
          {timestamp && (
            <span
              className={`text-xs ${
                isUser ? 'text-white/60' : 'text-[var(--text-secondary)]'
              }`}
            >
              {formatTimestamp(timestamp)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="text-sm">{renderContent(content)}</div>
      </div>
    </div>
  );
}

interface ThinkingBlockProps {
  content: string;
  timestamp?: string;
}

/**
 * Collapsible thinking block for assistant reasoning
 */
export function ThinkingBlock({ content, timestamp }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Truncate content for preview
  const preview = content.length > 100 ? content.slice(0, 100) + '...' : content;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)] hover:border-[var(--text-secondary)] transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Thinking...
            </span>
          </div>
          {timestamp && (
            <span className="text-xs text-[var(--text-secondary)]">
              {formatTimestamp(timestamp)}
            </span>
          )}
        </div>

        {!isExpanded && (
          <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-2">
            {preview}
          </p>
        )}
      </button>

      {isExpanded && (
        <div className="mt-1 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}
