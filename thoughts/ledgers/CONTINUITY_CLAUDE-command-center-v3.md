# Session: command-center-v3
Updated: 2026-01-25T15:33:10.446Z

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
- Now: [ ] Sprint 1: Foundation (fix bugs + 3-panel layout + sidebar)
- Next:
  - [ ] Sprint 2: Core Value (conversation view + message input)
  - [ ] Sprint 3: Ledger Management (viewer/editor + actions)
  - [ ] Sprint 4: Polish (cross-session intelligence)

## Sprint 1 Tasks
- [ ] Fix auto-detector persistence (line 384)
- [ ] Remove hardcoded area patterns
- [ ] Implement 3-panel layout in App.tsx
- [ ] Create SessionsList component
- [ ] Create LedgersBrowser component
- [ ] Add ledger IPC handlers (get-ledgers, read-ledger)

## Open Questions
- None currently

## Working Set
- **Plan**: `thoughts/shared/plans/command-center-v3.md`
- **Mockup**: `thoughts/shared/plans/claude-command-center-v3-embedded.html`
- **Key Files**:
  - `electron/main.ts` - IPC handlers
  - `electron/preload.cjs` - API bridge
  - `src/App.tsx` - Main layout
  - `electron/services/auto-detector.ts` - Bug fixes needed

## Quick Start

```bash
# Start dev server
npm run dev

# Read the plan
cat thoughts/shared/plans/command-center-v3.md

# Open mockup in browser
open thoughts/shared/plans/claude-command-center-v3-embedded.html
```

## Sprint 1 Verification
- [ ] 3-panel layout renders (sidebar + main + context)
- [ ] Sessions list shows active sessions
- [ ] Ledgers browser shows CONTINUITY_CLAUDE-*.md files
- [ ] Auto-detector persists values correctly
