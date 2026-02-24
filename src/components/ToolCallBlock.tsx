import { useState, useCallback, useMemo, memo } from 'react';

interface ToolCallBlockProps {
  toolName: string;
  input?: string;
  output?: string;
  filesTouched?: string;
  timestamp?: string;
}

// --- Pure helpers moved to module level (3C) ---

const getStatusBorderColor = (status: 'success' | 'error' | 'neutral') => {
  switch (status) {
    case 'success':
      return 'border-l-4 border-l-[var(--success)]';
    case 'error':
      return 'border-l-4 border-l-[var(--error)]';
    default:
      return 'border-l-4 border-l-[var(--border)]';
  }
};

const formatJson = (str: string | undefined): string | null => {
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return str;
  }
};

const getToolIcon = (name: string) => {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('read') || lowerName === 'read') {
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

  if (lowerName.includes('task') || lowerName.includes('agent')) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    );
  }

  if (lowerName.includes('web')) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
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

const getStatus = (output: string | undefined): 'success' | 'error' | 'neutral' => {
  if (!output) return 'neutral';
  const lowerOutput = output.toLowerCase();
  if (
    lowerOutput.includes('error') ||
    lowerOutput.includes('failed') ||
    lowerOutput.includes('exception') ||
    lowerOutput.includes('not found') ||
    lowerOutput.includes('permission denied')
  ) {
    return 'error';
  }
  if (output.length > 0) {
    return 'success';
  }
  return 'neutral';
};

const getSummary = (toolName: string, input: string | undefined, files: string[]): string => {
  const lowerName = toolName.toLowerCase();
  let parsedInput: Record<string, unknown> = {};

  try {
    if (input) {
      parsedInput = JSON.parse(input);
    }
  } catch {
    // Input isn't JSON, use raw
  }

  if (lowerName === 'read') {
    const filePath = parsedInput.file_path as string || '';
    const filename = filePath.split('/').pop() || filePath;
    return `Read ${filename}`;
  }

  if (lowerName === 'write') {
    const filePath = parsedInput.file_path as string || '';
    const filename = filePath.split('/').pop() || filePath;
    return `Created ${filename}`;
  }

  if (lowerName === 'edit') {
    const filePath = parsedInput.file_path as string || '';
    const filename = filePath.split('/').pop() || filePath;
    return `Edited ${filename}`;
  }

  if (lowerName === 'bash') {
    const command = parsedInput.command as string || '';
    const truncated = command.length > 50 ? command.substring(0, 50) + '...' : command;
    return `$ ${truncated}`;
  }

  if (lowerName === 'grep') {
    const pattern = parsedInput.pattern as string || '';
    return `Searched for: ${pattern}`;
  }

  if (lowerName === 'glob') {
    const pattern = parsedInput.pattern as string || '';
    return `Files matching: ${pattern}`;
  }

  if (lowerName === 'webfetch') {
    const url = parsedInput.url as string || '';
    try {
      const hostname = new URL(url).hostname;
      return `Fetched ${hostname}`;
    } catch {
      return `Fetched URL`;
    }
  }

  if (lowerName === 'websearch') {
    const query = parsedInput.query as string || '';
    return `Searched: ${query}`;
  }

  if (lowerName === 'task') {
    const description = parsedInput.description as string || '';
    return `Agent: ${description}`;
  }

  if (files.length > 0) {
    return `${toolName}: ${files[0].split('/').pop()}`;
  }

  return toolName;
};

// --- Component ---

/**
 * Render tool calls with collapsible input/output
 * Enhanced with:
 * - Plain-English summary for collapsed state
 * - Status border colors (green/red/gray)
 * - Copy buttons for input/output
 */
export const ToolCallBlock = memo(function ToolCallBlock({
  toolName,
  input,
  output,
  filesTouched,
  timestamp,
}: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<'input' | 'output' | null>(null);

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 3C: Memoize files splitting
  const files = useMemo(
    () => (filesTouched ? filesTouched.split(',').filter(Boolean) : []),
    [filesTouched]
  );

  // 3C: Memoize status
  const status = useMemo(() => getStatus(output), [output]);

  // 3C: Memoize summary (calls JSON.parse)
  const summary = useMemo(() => getSummary(toolName, input, files), [toolName, input, files]);

  // 3C: Memoize tool icon
  const toolIcon = useMemo(() => getToolIcon(toolName), [toolName]);

  // 3C: Memoize border color
  const statusBorderColor = useMemo(() => getStatusBorderColor(status), [status]);

  // 3C: Memoize formatted JSON for input and output
  const formattedInput = useMemo(() => formatJson(input), [input]);
  const formattedOutput = useMemo(() => formatJson(output), [output]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, field: 'input' | 'output') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  // Copy button component
  const CopyButton = ({ text, field }: { text: string; field: 'input' | 'output' }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard(text, field);
      }}
      className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
      title={copiedField === field ? 'Copied!' : `Copy ${field}`}
    >
      {copiedField === field ? (
        <svg className="w-4 h-4 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full text-left p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] hover:border-[var(--text-secondary)] transition-colors ${statusBorderColor}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <svg
              className={`w-4 h-4 flex-shrink-0 text-[var(--text-secondary)] transition-transform ${
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
            <span className="text-[var(--accent-primary)] flex-shrink-0">{toolIcon}</span>
            <span className="text-sm font-medium truncate">{summary}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status indicator */}
            {status === 'error' && (
              <span className="text-xs px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded">
                error
              </span>
            )}
            {timestamp && (
              <span className="text-xs text-[var(--text-secondary)]">
                {formatTimestamp(timestamp)}
              </span>
            )}
          </div>
        </div>

        {/* Files touched preview (collapsed) */}
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
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className={`mt-1 border border-[var(--border)] rounded-lg overflow-hidden ${statusBorderColor}`}>
          {/* Input section */}
          {input && (
            <div className="p-3 border-b border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Input
                </span>
                <CopyButton text={input} field="input" />
              </div>
              <pre className="text-xs bg-[var(--bg-primary)] p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
                <code className="font-mono text-[var(--text-primary)]">
                  {formattedInput}
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
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Output
                </span>
                <CopyButton text={output} field="output" />
              </div>
              <pre className="text-xs bg-[var(--bg-primary)] p-2 rounded overflow-x-auto max-h-96 overflow-y-auto">
                <code className="font-mono text-[var(--text-primary)] whitespace-pre-wrap">
                  {formattedOutput}
                </code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
