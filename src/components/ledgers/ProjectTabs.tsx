import type { ProjectWithLedgers } from '../../types/electron';

interface ProjectTabsProps {
  projects: ProjectWithLedgers[];
  selectedProjectPath: string | null;
  onSelectProject: (projectPath: string | null) => void;
  showAll?: boolean;
}

export function ProjectTabs({
  projects,
  selectedProjectPath,
  onSelectProject,
  showAll = true,
}: ProjectTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1">
      {showAll && (
        <button
          onClick={() => onSelectProject(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
            selectedProjectPath === null
              ? 'bg-[var(--accent-primary)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          All Projects
        </button>
      )}

      {projects.map((project) => (
        <button
          key={project.projectPath}
          onClick={() => onSelectProject(project.projectPath)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
            selectedProjectPath === project.projectPath
              ? 'bg-[var(--accent-primary)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <span>{project.projectName}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] ${
              selectedProjectPath === project.projectPath
                ? 'bg-white/20'
                : 'bg-[var(--bg-secondary)]'
            }`}
          >
            {project.ledgerCount}
          </span>
        </button>
      ))}
    </div>
  );
}
