# Session: command-center-v3
Updated: 2026-02-24T16:07:16.420Z

## Goal
Transform Claude Session Manager v1 into an IDE-like command center with:
1. Embedded session interaction (send prompts directly to sessions)
2. Ledger management (browse, view, edit, link to sessions)
3. 3-panel IDE layout (sidebar + main + context)
4. Session actions (resume from ledger, create handoff, split)

Done when:
- Can view full conversation in app
- Can send prompts to sessions from app
- Can browse and manage CONTINUITY_CLAUDE-*.md ledgers
- Can resume sessions from ledger context

## Constraints
- Standalone app at `~/workspace/claude-session-manager/`
- Keep working: Electron 33, native CJS preload, better-sqlite3
- Dark theme consistent with v3 mockup
- No breaking changes to existing v1 functionality during migration

## Key Decisions
- **IDE layout over tmux mirror**: User feedback showed single-session focus is more valuable
- **Embedded interaction**: Send prompts via `tmux send-keys` instead of just viewing
- **Ledger as first-class**: Full CRUD operations, not just links
- **Collapsible tool calls**: Keep UI clean while preserving detail access

## State
- Done:
  - [x] v1 complete and working
  - [x] v3 mockup created (claude-command-center-v3-embedded.html)
  - [x] Implementation plan written
  - [x] Roadmap with 4 sprints defined
  - [x] Sprint 1: Foundation (fix bugs + 3-panel layout + sidebar)
  - [x] Sprint 2: Core Value (conversation view + message input)
  - [x] AI-First Notification System (5 phases complete)
  - [x] Sprint 5.1: Foundation - ConfigManager, Navigation, SettingsPage
  - [x] Sprint 5.2: Hooks + Skills - HooksPage (test/source), SkillsPage (trigger tester), RulesPage (toggle)
  - [x] Sprint 5.3: MCP + Plugins Management - MCPPage (test/toggle), PluginsPage (combined view)
  - [x] Sprint 3: Ledger Management (6 phases complete)
  - [x] Sprint 4: Cross-session intelligence (6 phases complete)
  - [x] Embedded Terminal: xterm.js + node-pty integration for live tmux pane viewing
  - [x] Sprint 5.4: AI Insights (correction detection, workflow mining)
  - [x] Open in Terminal: Smart session opening (attach if active, resume if stale)
  - [x] Sprint 5.5: Polish (keyboard shortcuts, error handling, loading states, branding)
  - [x] Ledger Hub: Cross-project ledger management (6 phases complete)
- Now: [→] Additional enhancements TBD
- Next:
  - [ ] Documentation

## Sprint 1 Tasks (COMPLETED)
- [x] Fix auto-detector persistence (line 384) - Added `updateSessionDetectedFields()` to database.ts
- [x] Remove hardcoded area patterns - Replaced with prioritized weighted heuristics
- [x] Implement 3-panel layout in App.tsx - Left (224px) + Main (flex) + Right (288px)
- [x] Create SessionsList component - With search, status dots, tmux pane IDs
- [x] Create LedgersBrowser component - Loads from ~/workspace/*/thoughts/ledgers/
- [x] Add ledger IPC handlers (get-ledgers, read-ledger)
- [x] Create QuickAccess component (placeholders)
- [x] Create ContextPanel component (files touched, session info, actions)
- [x] Update CSS to v3 GitHub-dark theme

## Sprint 2 Tasks (COMPLETED)
- [x] Add send-to-pane IPC bridge - Handler in main.ts, exposed in preload.cjs, typed in electron.d.ts
- [x] Create MessageInput component - Auto-resize textarea, Enter to send, Shift+Enter for newline
- [x] Integrate MessageInput into ConversationViewer - With send handler, loading state, error toast
- [x] Enhanced ToolCallBlock display - Plain-English summaries, status borders (green/red/gray), copy buttons
- [x] Real-time session update polling - Every 3 seconds for active sessions, hasNewEvents flag

## Sprint 2 Verification
- [x] Build passes (`npm run build`)
- [ ] send-to-pane handler returns success for valid session (MANUAL TEST NEEDED)
- [ ] MessageInput renders at bottom of ConversationViewer (MANUAL TEST NEEDED)
- [ ] Enter sends message, Shift+Enter adds newline (MANUAL TEST NEEDED)
- [ ] Disabled for non-active sessions (MANUAL TEST NEEDED)
- [ ] Tool calls show meaningful summaries (MANUAL TEST NEEDED)
- [ ] Status border colors correct (green/red/gray) (MANUAL TEST NEEDED)
- [ ] Copy buttons work for input/output (MANUAL TEST NEEDED)
- [ ] New events appear without manual refresh (MANUAL TEST NEEDED)

## Open Questions
- None currently

## Working Set
- **Plan**: `thoughts/shared/plans/command-center-v3.md`
- **Mockup**: `thoughts/shared/plans/claude-command-center-v3-embedded.html`
- **Key Files**:
  - `electron/main.ts` - IPC handlers (ledger ops, handoff, split, terminal, insights)
  - `electron/preload.cjs` - API bridge
  - `src/App.tsx` - Main 3-panel layout with modals
  - `src/components/modals/` - LedgerViewer, LedgerEditor, SplitSessionDialog
  - `src/components/TerminalViewer.tsx` - Embedded xterm.js terminal
  - `src/components/ConversationViewer.tsx` - Terminal/History toggle view
  - `electron/services/pty-manager.ts` - PTY and tmux pane attachment
  - `electron/services/ledger-service.ts` - Ledger parsing/updating with progress calculation
  - `electron/services/handoff-service.ts` - Handoff generation
  - `electron/services/session-pattern-analyzer.ts` - Correction detection, workflow mining
  - `electron/services/insights-aggregator.ts` - Rule suggestions, config health
  - `src/pages/InsightsPage.tsx` - AI Insights dashboard
  - `src/pages/LedgersPage.tsx` - Ledger Hub main page
  - `src/pages/LedgerDetailPage.tsx` - Full-page ledger editor
  - `src/components/ledgers/` - Ledger UI components
  - `src/stores/ledgerStore.ts` - Ledger state management
  - `src/hooks/useLedgers.ts` - Ledger operations hook
  - `src/types/electron.d.ts` - Full type definitions

## Quick Start

```bash
# Start dev server
npm run dev

# Read the plan
cat thoughts/shared/plans/command-center-v3.md

# Open mockup in browser
open thoughts/shared/plans/claude-command-center-v3-embedded.html
```

## AI-First Notification System (COMPLETED)
- [x] Phase 1: Hook → App Communication (event protocol, file watcher)
- [x] Phase 2: Notification Manager Service (routing, cross-platform sound)
- [x] Phase 3: AI Intelligence Layer (rule-based + Claude API analysis)
- [x] Phase 4: Tray Icon Intelligence (dynamic icons, pulse animation, macOS badge)
- [x] Phase 5: Settings & Preferences UI (sound/notification toggles, test buttons)

### Notification System Files:
- `~/.claude/hooks/stop-verify-completion.py` - Emits notification events
- `electron/services/notification-watcher.ts` - Watches pending directory
- `electron/services/notification-manager.ts` - Central routing hub
- `electron/services/sound-manager.ts` - Cross-platform audio
- `electron/services/ai-analyzer.ts` - Importance scoring + summaries
- `electron/services/tray-manager.ts` - Dynamic tray icons
- `src/pages/NotificationSettingsPage.tsx` - User preferences UI

## Sprint 5: Config Management + AI Insights

### Sprint 5.1 (COMPLETED)
- [x] ConfigManager service (electron/services/config-manager.ts)
- [x] Settings IPC handlers (get-settings, save-settings, get-mcp-config, save-mcp-config)
- [x] Navigation component with Command Center section
- [x] SettingsPage with JSON editor, global/project tabs, diff view

### Sprint 5.2 (COMPLETED)
- [x] HookManager service (electron/services/hook-manager.ts)
- [x] HooksPage - list hooks by event type, view source, test with JSON input
- [x] SkillManager service (electron/services/skill-manager.ts)
- [x] SkillsPage - browse skills, view SKILL.md, trigger pattern tester
- [x] RuleManager service (electron/services/rule-manager.ts)
- [x] RulesPage - browse rules, view content, enable/disable toggle

### Sprint 5.3 (COMPLETED)
- [x] MCPTester service (electron/services/mcp-tester.ts) - JSON-RPC handshake, list tools
- [x] MCPPage - list MCP servers, test connectivity, add/remove, enable/disable
- [x] PluginsPage - combined skills + rules view, filter tabs, toggle rules
- [x] IPC handlers: test-mcp-server, get-mcp-server-statuses, toggle-mcp-server, add-mcp-server, remove-mcp-server

### Sprint 5.4 (COMPLETED)
- [x] SessionPatternAnalyzer service (electron/services/session-pattern-analyzer.ts) - Correction detection, workflow mining
- [x] InsightsAggregator service (electron/services/insights-aggregator.ts) - Rule suggestions, config health
- [x] Database queries (getSessionsWithEvents, getToolUsageStats, getFileModificationFrequency)
- [x] IPC handlers: get-session-corrections, get-workflow-patterns, get-rule-suggestions, get-config-health, refresh-insights
- [x] InsightsPage UI - Config health card, tool usage, corrections list, workflow patterns, rule suggestions

### Sprint 5.5 (COMPLETED)
- [x] Toast notification system (Toast.tsx, useToast.ts)
- [x] Keyboard shortcuts (⌘N, ⌘R, ⌘,, ?, Escape)
- [x] KeyboardShortcutsHelp modal
- [x] Loading states with Skeleton components (SessionGrid, LedgersBrowser, ConversationViewer)
- [x] Window title branding ("Claude Session Manager")

### Sprint 5.5 New Files:
- `src/components/ui/Toast.tsx` - Toast notification component with variants
- `src/hooks/useToast.ts` - Hook for triggering toasts
- `src/components/modals/KeyboardShortcutsHelp.tsx` - Help overlay showing all shortcuts

## Sprint 3 Tasks (COMPLETED)
- [x] LedgerViewer modal - Full-screen ledger view with markdown rendering
- [x] LedgerEditor with markdown - Edit ledger content with live preview
- [x] Resume from ledger action - Spawn new session with ledger context
- [x] Update ledger action - Parse, update checkboxes, write back atomically
- [x] Create handoff action - Generate handoff document from session state
- [x] Split session action - Spawn new session linked to current

### Sprint 3 New Files:
- `src/components/modals/LedgerViewer.tsx` - Full-screen markdown-rendered ledger viewer
- `src/components/modals/LedgerEditor.tsx` - Split view editor with live preview
- `src/components/modals/SplitSessionDialog.tsx` - Task input modal for splitting
- `electron/services/ledger-service.ts` - Ledger parsing and updating
- `electron/services/handoff-service.ts` - Handoff document generation

### Sprint 3 New IPC Handlers:
- `resume-from-ledger` - Spawn session with ledger context
- `write-ledger` - Write content atomically with path validation
- `update-ledger` - Update checkboxes and current phase
- `parse-ledger` - Parse ledger into structured data
- `create-handoff` - Generate handoff from session
- `split-session` - Spawn child session with context link

## Sprint 4 Tasks (COMPLETED)
- [x] Phase 1: Database Layer - getFileConflicts(), getRelatedSessions() queries
- [x] Phase 2: React Hooks - useFileConflicts, useRelatedSessions
- [x] Phase 3: Related Sessions UI - RelatedSessions component in ContextPanel
- [x] Phase 4: Conflict Indicators - ConflictBadge component on SessionCard
- [x] Phase 5: Command Palette (⌘K) - Global search for sessions, ledgers, actions
- [x] Phase 6: Loading States Polish - LoadingSpinner, Skeleton components

### Sprint 4 New Files:
- `src/hooks/useFileConflicts.ts` - Polls for file conflicts every 10s
- `src/hooks/useRelatedSessions.ts` - Fetches related sessions by shared files
- `src/components/context/RelatedSessions.tsx` - List of related sessions
- `src/components/ConflictBadge.tsx` - Warning badge for file conflicts
- `src/components/modals/CommandPalette.tsx` - Global ⌘K command palette
- `src/components/ui/LoadingSpinner.tsx` - Animated spinner
- `src/components/ui/Skeleton.tsx` - Loading skeletons

### Sprint 4 New IPC Handlers:
- `get-file-conflicts` - Files edited by multiple active/idle sessions
- `get-related-sessions` - Sessions touching same files

## Embedded Terminal Feature (COMPLETED)
Replaces parsed JSONL conversation view with live xterm.js terminal.

### New Files:
- `electron/services/pty-manager.ts` - PTY session management with tmux attachment
- `src/components/TerminalViewer.tsx` - xterm.js wrapper with dark theme

### New IPC Handlers:
- `terminal-connect` - Attach to tmux pane via PTY
- `terminal-input` - Send keystrokes to terminal
- `terminal-special-key` - Send special keys (Enter, Escape, etc.)
- `terminal-disconnect` - Detach from terminal
- `terminal-resize` - Handle terminal resize events
- Events: `terminal-output`, `terminal-exit`

### Dependencies Added:
- `node-pty` - Native PTY module for terminal spawning
- `xterm` - Terminal emulator for the browser
- `xterm-addon-fit` - Auto-fit terminal to container
- `xterm-addon-web-links` - Clickable URLs in terminal

### View Toggle:
ConversationViewer now has Terminal/History toggle for sessions with tmux mapping.

## Ledger Hub Feature (COMPLETED)
Cross-project ledger management with dedicated page, progress tracking, and status visualization.

### Phases Completed:
- [x] Phase 1: Enhanced Data Model - EnhancedLedger, ProjectWithLedgers types, progress/status calculation
- [x] Phase 2: State Management - ledgerStore.ts (Zustand), useLedgers.ts hook
- [x] Phase 3: UI Components - LedgerCard, LedgerStatusBadge, LedgerProgressBar, ProjectTabs, LedgerQuickActions
- [x] Phase 4: Pages & Routing - LedgersPage, LedgerDetailPage, routes in App.tsx
- [x] Phase 5: Navigation Integration - Ledgers nav item, "View All" link in sidebar
- [x] Phase 6: Polish - ⌘L keyboard shortcut, keyboard help update

### New Files:
- `src/stores/ledgerStore.ts` - Zustand store for ledger state
- `src/hooks/useLedgers.ts` - Hook for ledger operations
- `src/pages/LedgersPage.tsx` - Main ledger hub page with grid view
- `src/pages/LedgerDetailPage.tsx` - Full-page ledger editor
- `src/components/ledgers/LedgerCard.tsx` - Card with progress bar and quick actions
- `src/components/ledgers/LedgerStatusBadge.tsx` - Status pill (active/stale/completed)
- `src/components/ledgers/LedgerProgressBar.tsx` - Phase progress visualization
- `src/components/ledgers/ProjectTabs.tsx` - Project filter tabs
- `src/components/ledgers/LedgerQuickActions.tsx` - Resume/Edit/View buttons
- `src/components/ledgers/index.ts` - Exports

### New IPC Handlers:
- `get-ledgers-enhanced` - Returns ledgers with progress/status calculation
- `get-projects-with-ledgers` - Returns ledgers grouped by project

### Routes:
- `/ledgers` - Main ledger hub
- `/ledgers/:projectName` - Filtered by project
- `/ledger/:ledgerPath` - Detail page (base64 encoded path)

### Features:
- Project tabs for filtering by project
- Status filter (All/Active/Stale/Completed)
- Progress bars showing phases completed
- Status badges (green=active, yellow=stale, gray=completed)
- Quick actions on hover (Resume, Edit, View Full)
- Two-column layout with detail sidebar
- Full-page editor with split view
- ⌘L keyboard shortcut
