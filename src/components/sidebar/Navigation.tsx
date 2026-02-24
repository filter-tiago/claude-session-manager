import { useLocation, Link } from 'react-router-dom';
import { useState } from 'react';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  phase?: string;
}

const navItems: NavItem[] = [
  {
    id: 'sessions',
    label: 'Sessions',
    path: '/',
    icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'workspaces',
    label: 'Workspaces',
    path: '/workspaces',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  },
  {
    id: 'ledgers',
    label: 'Ledgers',
    path: '/ledgers',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    path: '/notifications',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  },
  {
    id: 'hooks',
    label: 'Hooks',
    path: '/hooks',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    phase: '5.2',
  },
  {
    id: 'skills',
    label: 'Skills',
    path: '/skills',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    phase: '5.2',
  },
  {
    id: 'rules',
    label: 'Rules',
    path: '/rules',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    phase: '5.2',
  },
  {
    id: 'plugins',
    label: 'Plugins',
    path: '/plugins',
    icon: 'M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z',
    phase: '5.3',
  },
  {
    id: 'mcp',
    label: 'MCP Servers',
    path: '/mcp',
    icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
    phase: '5.3',
  },
  {
    id: 'insights',
    label: 'Insights',
    path: '/insights',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    phase: '5.4',
  },
  {
    id: 'tmux',
    label: 'Tmux',
    path: '/tmux',
    icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
];

export function Navigation() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex flex-col border-t border-[var(--border)]">
      {/* Section Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-tertiary)] transition-colors duration-200"
      >
        <span className="text-xs font-semibold text-gradient uppercase tracking-wider">
          Command Center
        </span>
        <svg
          className={`w-3 h-3 text-[var(--accent-primary)] transition-transform duration-200 ${
            isCollapsed ? '' : 'rotate-180'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Navigation Items */}
      {!isCollapsed && (
        <nav className="px-2 pb-2 animate-fade-in">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isPlaceholder = !!item.phase;

            return (
              <Link
                key={item.id}
                to={item.path}
                className={`w-full px-2 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2 text-xs ${
                  isActive
                    ? 'glass-strong text-[var(--accent-primary)] border-l-2 border-[var(--accent-primary)] -ml-0.5 pl-2.5 glow-accent'
                    : isPlaceholder
                      ? 'text-[var(--text-muted)] hover:glass opacity-60'
                      : 'text-[var(--text-secondary)] hover:glass hover:text-[var(--text-primary)]'
                }`}
              >
                <svg
                  className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[var(--accent-primary)]' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span className="flex-1">{item.label}</span>
                {item.phase && (
                  <span className="text-[10px] text-[var(--accent-secondary)] opacity-50">
                    {item.phase}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
