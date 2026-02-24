import { useState, useCallback } from 'react';

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void;
  projects: string[];
  currentFilters: FilterState;
}

export interface FilterState {
  status?: 'active' | 'idle' | 'completed';
  project?: string;
  dateRange?: 'today' | 'week' | 'month' | 'all';
  activity?: string;
}

export function FilterBar({ onFilterChange, projects, currentFilters }: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: string | undefined) => {
      const newFilters = { ...currentFilters, [key]: value || undefined };
      onFilterChange(newFilters);
    },
    [currentFilters, onFilterChange]
  );

  const clearFilters = useCallback(() => {
    onFilterChange({});
  }, [onFilterChange]);

  const hasActiveFilters = Object.values(currentFilters).some((v) => v);

  return (
    <div className="border-b border-[var(--border)]">
      {/* Filter toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 text-xs bg-[var(--accent-primary)] text-white rounded">
              Active
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Filter options */}
      {isExpanded && (
        <div className="px-4 py-3 space-y-3 bg-[var(--bg-tertiary)]">
          {/* Status filter */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Status</label>
            <div className="flex gap-1">
              {(['active', 'idle', 'completed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() =>
                    handleFilterChange('status', currentFilters.status === status ? undefined : status)
                  }
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    currentFilters.status === status
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Date range filter */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Date Range</label>
            <div className="flex gap-1">
              {(['today', 'week', 'month', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() =>
                    handleFilterChange('dateRange', currentFilters.dateRange === range ? undefined : range)
                  }
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    currentFilters.dateRange === range
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Project filter */}
          {projects.length > 0 && (
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">Project</label>
              <select
                value={currentFilters.project || ''}
                onChange={(e) => handleFilterChange('project', e.target.value || undefined)}
                className="w-full px-2 py-1 text-xs bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Activity filter */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Activity</label>
            <div className="flex flex-wrap gap-1">
              {['implementing', 'editing', 'exploring', 'debugging', 'testing', 'chatting'].map(
                (activity) => (
                  <button
                    key={activity}
                    onClick={() =>
                      handleFilterChange(
                        'activity',
                        currentFilters.activity === activity ? undefined : activity
                      )
                    }
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      currentFilters.activity === activity
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                    }`}
                  >
                    {activity.charAt(0).toUpperCase() + activity.slice(1)}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-[var(--accent-primary)] hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
