import type { Session, SessionStats } from '../types/electron';
import { SessionCard } from './SessionCard';

interface SessionGridProps {
  sessions: Session[];
  stats: SessionStats | null;
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  isLoading: boolean;
}

/**
 * Main grid showing all sessions as cards
 * Displays stats at the top and a responsive grid of session cards
 */
export function SessionGrid({
  sessions,
  stats,
  selectedSessionId,
  onSelectSession,
  isLoading,
}: SessionGridProps) {
  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      {/* Stats header */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Sessions"
            value={stats.total}
            color="var(--text-primary)"
          />
          <StatCard
            label="Active"
            value={stats.active}
            color="var(--success)"
          />
          <StatCard
            label="Idle"
            value={stats.idle}
            color="var(--warning)"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            color="var(--text-secondary)"
          />
        </div>
      )}

      {/* Sessions grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-[var(--text-secondary)]">Loading sessions...</div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
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
            <h3 className="text-lg font-medium mb-1">No sessions found</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Sessions will appear here as Claude CLI sessions are detected.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.session_id}
                session={session}
                isSelected={selectedSessionId === session.session_id}
                onClick={() => onSelectSession(session.session_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
      <div className="text-3xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-sm text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}
