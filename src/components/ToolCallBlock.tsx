import { useState } from 'react';

interface ToolCallBlockProps {
  toolName: string;
  input?: string;
  output?: string;
  filesTouched?: string;
  timestamp?: string;
}

/**
 * Render tool calls with collapsible input/output
 */
export function ToolCallBlock({
  toolName,
  input,
  output,
  filesTouched,
  timestamp,
}: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Parse files touched
  const files = filesTouched ? filesTouched.split(',').filter(Boolean) : [];

  // Get tool icon based on name
  const getToolIcon = (name: string) => {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('read') || lowerName.includes('file')) {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    }

    if (lowerName.includes('write') || lowerName.includes('edit')) {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      );
    }

    if (lowerName.includes('bash') || lowerName.includes('terminal') || lowerName.includes('exec')) {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    }

    if (lowerName.includes('search') || lowerName.includes('grep') || lowerName.includes('glob')) {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
    }

    // Default tool icon
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    );
  };

  // Format JSON for display
  const formatJson = (str: string | undefined) => {
    if (!str) return null;
    try {
      const parsed = JSON.parse(str);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return str;
    }
  };

  // Truncate output for preview
  const getOutputPreview = () => {
    if (!output) return null;
    const text = output.length > 150 ? output.slice(0, 150) + '...' : output;
    return text;
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] hover:border-[var(--text-secondary)] transition-colors"
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
            <span className="text-[var(--accent-primary)]">{getToolIcon(toolName)}</span>
            <span className="text-sm font-medium">{toolName}</span>
          </div>
          {timestamp && (
            <span className="text-xs text-[var(--text-secondary)]">
              {formatTimestamp(timestamp)}
            </span>
          )}
        </div>

        {/* Files touched preview */}
        {files.length > 0 && !isExpanded && (
          <div className="mt-2 flex flex-wrap gap-1">
            {files.slice(0, 3).map((file, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-[var(--bg-primary)] rounded font-mono text-[var(--text-secondary)]"
              >
                {file.split('/').pop()}
              </span>
            ))}
            {files.length > 3 && (
              <span className="text-xs text-[var(--text-secondary)]">
                +{files.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Output preview */}
        {!isExpanded && getOutputPreview() && (
          <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-2 font-mono">
            {getOutputPreview()}
          </p>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-1 border border-[var(--border)] rounded-lg overflow-hidden">
          {/* Input section */}
          {input && (
            <div className="p-3 border-b border-[var(--border)]">
              <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Input
              </div>
              <pre className="text-xs bg-[var(--bg-primary)] p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
                <code className="font-mono text-[var(--text-primary)]">
                  {formatJson(input)}
                </code>
              </pre>
            </div>
          )}

          {/* Files touched */}
          {files.length > 0 && (
            <div className="p-3 border-b border-[var(--border)]">
              <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Files Touched
              </div>
              <div className="flex flex-wrap gap-1">
                {files.map((file, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 bg-[var(--bg-primary)] rounded font-mono text-[var(--text-primary)]"
                  >
                    {file}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Output section */}
          {output && (
            <div className="p-3">
              <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Output
              </div>
              <pre className="text-xs bg-[var(--bg-primary)] p-2 rounded overflow-x-auto max-h-96 overflow-y-auto">
                <code className="font-mono text-[var(--text-primary)] whitespace-pre-wrap">
                  {formatJson(output)}
                </code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
