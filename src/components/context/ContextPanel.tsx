import { useMemo } from 'react';
import type { Session, SessionEvent, Ledger } from '../../types/electron';
import { RelatedSessions } from './RelatedSessions';

interface ContextPanelProps {
  session: Session;
  events: SessionEvent[];
  linkedLedger?: Ledger | null;
  relatedSessions?: Session[];
  relatedSessionsLoading?: boolean;
  onResumeFromLedger?: () => void;
  onUpdateLedger?: () => void;
  onCreateHandoff?: () => void;
  onSplitSession?: () => void;
  onOpenInTerminal?: () => void;
  onSelectRelatedSession?: (sessionId: string) => void;
}

export function ContextPanel({
  session,
  events,
  linkedLedger,
  relatedSessions = [],
  relatedSessionsLoading = false,
  onResumeFromLedger,
  onUpdateLedger,
  onCreateHandoff,
  onSplitSession,
  onOpenInTerminal,
  onSelectRelatedSession,
}: ContextPanelProps) {
  // 3E: Memoize files extraction to avoid recomputing on every render
  const filesTouched = useMemo(() => extractFilesTouched(events), [events]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Context</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active Ledger Section */}
        <section className="p-4 border-b border-[var(--border)]">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Active Ledger
          </h4>
          {linkedLedger ? (
            <div className="bg-[var(--bg-tertiary)] rounded-md p-2">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-[var(--purple)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{linkedLedger.name}</div>
                  {linkedLedger.currentPhase && (
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      {linkedLedger.currentPhase}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[var(--text-secondary)]">
              {session.ledger_link ? (
                <span className="text-[var(--warning)]">Linked: {session.ledger_link}</span>
              ) : (
                'No ledger linked'
              )}
            </div>
          )}
        </section>

        {/* Files Touched Section */}
        <section className="p-4 border-b border-[var(--border)]">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Files Touched
          </h4>
          {filesTouched.length === 0 ? (
            <div className="text-xs text-[var(--text-secondary)]">No files modified</div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filesTouched.slice(0, 20).map((file, index) => (
                <FileItem key={index} file={file} />
              ))}
              {filesTouched.length > 20 && (
                <div className="text-[10px] text-[var(--text-secondary)] pt-1">
                  +{filesTouched.length - 20} more files
                </div>
              )}
            </div>
          )}
        </section>

        {/* Session Info Section */}
        <section className="p-4 border-b border-[var(--border)]">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Session Info
          </h4>
          <div className="space-y-1 text-xs">
            <InfoRow label="Status" value={session.status} />
            <InfoRow label="Messages" value={session.message_count.toString()} />
            <InfoRow label="Tool Calls" value={session.tool_call_count.toString()} />
            {session.detected_area && <InfoRow label="Area" value={session.detected_area} />}
            {session.detected_activity && (
              <InfoRow label="Activity" value={session.detected_activity} />
            )}
            {session.git_branch && <InfoRow label="Branch" value={session.git_branch} />}
          </div>
        </section>

        {/* Actions Section */}
        <section className="p-4">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Actions
          </h4>
          <div className="space-y-2">
            <ActionButton
              label="Open in Terminal"
              icon="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              onClick={onOpenInTerminal}
            />
            <ActionButton
              label="Resume from Ledger"
              icon="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              onClick={onResumeFromLedger}
              disabled={!linkedLedger}
            />
            <ActionButton
              label="Update Ledger"
              icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              onClick={onUpdateLedger}
              disabled={!linkedLedger}
            />
            <ActionButton
              label="Create Handoff"
              icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              onClick={onCreateHandoff}
              disabled
            />
            <ActionButton
              label="Split to New Session"
              icon="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              onClick={onSplitSession}
              disabled
            />
          </div>
        </section>

        {/* Related Sessions Section */}
        <section className="p-4 border-t border-[var(--border)]">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Related Sessions
          </h4>
          <RelatedSessions
            sessions={relatedSessions}
            isLoading={relatedSessionsLoading}
            onSelectSession={onSelectRelatedSession || (() => {})}
          />
        </section>
      </div>
    </div>
  );
}

interface FileItemProps {
  file: { path: string; type: 'added' | 'modified' | 'deleted' };
}

function FileItem({ file }: FileItemProps) {
  const typeIndicator = {
    added: { char: '+', color: 'text-[var(--success)]' },
    modified: { char: '~', color: 'text-[var(--warning)]' },
    deleted: { char: '-', color: 'text-[var(--error)]' },
  }[file.type];

  const fileName = file.path.split('/').pop() || file.path;

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      <span className={`w-3 ${typeIndicator.color}`}>{typeIndicator.char}</span>
      <span className="truncate text-[var(--text-secondary)]" title={file.path}>
        {fileName}
      </span>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
}

function ActionButton({ label, icon, onClick, disabled }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-3 py-2 text-left rounded-md transition-colors flex items-center gap-2 text-xs ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-[var(--bg-tertiary)]'
          : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border)]'
      }`}
    >
      <svg
        className="w-4 h-4 text-[var(--text-secondary)]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <span>{label}</span>
    </button>
  );
}

// Helper to extract files touched from events
function extractFilesTouched(
  events: SessionEvent[]
): Array<{ path: string; type: 'added' | 'modified' | 'deleted' }> {
  const fileMap = new Map<string, 'added' | 'modified' | 'deleted'>();

  for (const event of events) {
    if (event.files_touched) {
      const files = event.files_touched.split(',').map((f) => f.trim());
      for (const file of files) {
        if (!file) continue;

        // Determine type based on tool
        let type: 'added' | 'modified' | 'deleted' = 'modified';
        if (event.tool_name === 'Write') {
          type = fileMap.has(file) ? 'modified' : 'added';
        } else if (event.tool_name === 'Edit') {
          type = 'modified';
        }

        fileMap.set(file, type);
      }
    }
  }

  return Array.from(fileMap.entries()).map(([path, type]) => ({ path, type }));
}
