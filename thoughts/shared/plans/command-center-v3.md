# Claude CLI Command Center v3 - IDE Experience

## Overview

An **IDE-like command center** for managing Claude CLI sessions with **embedded session interaction** and **ledger management**. Focus on one session at a time with full conversation view and input capability.

## User Problem

```
- 32" wide monitor with 7+ tmux sessions (13+ Claude CLI instances)
- "I often lose track" of which session is doing what
- Current v1 has: Terrible UX, not parsing properly, active filter inflexible, not useful
- Need: Embedded CLI interaction, ledger management, maximized session view
```

## v3 Vision: IDE Experience

| Feature | v1 (Current) | v3 (Target) |
|---------|--------------|-------------|
| Session view | Flat list | **Single session focus with full conversation** |
| Interaction | View only | **Send prompts directly to session** |
| Ledgers | None | **Browse, view, edit, link to sessions** |
| Layout | Cramped cards | **IDE-like with sidebar + main + context** |
| Controls | Basic | **Resume from ledger, create handoff, split** |

## v3 Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: [Logo] Claude Command Center            [⌘K Quick Actions] [+ New] │
├──────────────────────────────────────────────────────────────────────────────┤
│ Left Sidebar │         Main: Session View          │    Right: Context      │
│ (w-56)       │         (flex-1)                    │    (w-72)              │
│              │                                      │                        │
│ ─ Sessions ─ │  Header: ETL Pipeline ● ea:%0       │  ─ Active Ledger ─     │
│ ● ETL Pipe   │  ────────────────────────────────   │  etl-pipeline          │
│ ● Cmd Center │                                      │  Goal: Build ETL...    │
│ ○ Voice      │  Conversation:                       │  State: Phase 3        │
│ ○ Slack      │  ┌─────────────────────────────┐    │                        │
│              │  │ You: Implement gold stage   │    │  ─ Files Touched ─     │
│ ─ Ledgers ─  │  └─────────────────────────────┘    │  + gold.py             │
│ 📄 etl-pipe  │  ┌─────────────────────────────┐    │  ~ models.py           │
│ 📄 voice     │  │ ▶ Thinking... (1.2s)        │    │                        │
│ 📄 session-m │  └─────────────────────────────┘    │  ─ Actions ─           │
│ 📄 business  │  ┌─────────────────────────────┐    │  [🔄 Resume ledger]    │
│              │  │ Claude: I'll implement...    │    │  [💾 Update ledger]    │
│ ─ Quick ─    │  │ 📖 Read silver.py ✓         │    │  [📋 Create handoff]   │
│ 📁 Plans     │  │ ✏️ Write gold.py ✓ Created  │    │  [🔀 Split session]    │
│ 📁 Handoffs  │  └─────────────────────────────┘    │                        │
│ ⚙️ Settings  │  ● Claude is working...             │  ─ Related ─           │
│              │                                      │  ○ Voice (shares file) │
│              │  ────────────────────────────────   │                        │
│              │  Input: [Send message...      📎📝] │                        │
│              │  Context: 45% │ 24 turns │ Ledger   │                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Core Features

### 1. Left Sidebar: Navigation
- **Sessions list**: All active Claude sessions with status indicators
  - Green pulsing = active, Yellow = idle, Red = error
  - Shows tmux pane ID (ea:%0, ea:%1, etc.)
- **Ledgers browser**: All CONTINUITY_CLAUDE-*.md files
  - Click to open in modal viewer
  - Create new ledger button
- **Quick Access**: Plans folder, Handoffs folder, Settings

### 2. Main Panel: Session View
- **Session header**: Name, status, tmux pane, project, controls
- **Conversation view**: Full chat history with:
  - User messages with timestamps
  - Claude responses with collapsible thinking blocks
  - Tool calls (Read, Write, Edit, Bash) with collapsible outputs
  - Active indicator when working
- **Input area**: Send prompts directly to the session via `tmux send-keys`
- **Status bar**: Context usage %, turn count, linked ledger

### 3. Right Sidebar: Context Panel
- **Active ledger**: Goal, state, last updated
- **Files touched**: List of files modified in session
  - `+` = created, `~` = modified, `·` = read
- **Session actions**:
  - Resume from ledger
  - Update ledger (sync current state)
  - Create handoff
  - Split to new session
- **Related sessions**: Other sessions touching same files

### 4. Ledger Modal Viewer
- Full-screen overlay to view/edit ledger content
- Markdown rendering with syntax highlighting
- "Resume This" button to start session with ledger context
- "Open in Session" to inject ledger into current session

### 5. Session Controls
| Control | Action |
|---------|--------|
| Focus tmux | `tmux select-pane -t target` |
| End session | Terminate with confirmation |
| Copy session | Export conversation |
| Send message | `tmux send-keys -t target "message" Enter` |

---

## v3 Implementation Phases

### Phase 1: Fix Foundation + New Layout
**Goal:** Fix v1 bugs and implement new IDE layout structure

**Bug fixes:**
1. **auto-detector.ts line 384**: Persist detected values
2. **Genericize area detection**: Remove hardcoded `areas/` pattern

**New layout:**
- Replace flat list with 3-panel IDE layout
- Left sidebar (w-56): Navigation
- Main (flex-1): Session view
- Right sidebar (w-72): Context panel

**Files to modify:**
- `electron/services/auto-detector.ts` - Fix persistence
- `src/App.tsx` - New 3-panel layout
- `src/index.css` - Dark theme variables

### Phase 2: Left Sidebar - Sessions + Ledgers
**Goal:** Navigation panel with sessions and ledgers

**Components:**
- `src/components/sidebar/SessionsList.tsx` - Active sessions with status
- `src/components/sidebar/LedgersBrowser.tsx` - Ledger file list
- `src/components/sidebar/QuickAccess.tsx` - Plans, Handoffs, Settings

**Data:**
- Sessions from existing store
- Ledgers via new IPC: `ipcMain.handle('get-ledgers')` scanning `thoughts/ledgers/`

**IPC additions to main.ts:**
```typescript
ipcMain.handle('get-ledgers', () => getLedgers());
ipcMain.handle('read-ledger', (_, path) => readLedger(path));
```

### Phase 3: Main Panel - Session View
**Goal:** Full conversation view with embedded interaction

**Components:**
- `src/components/session/SessionHeader.tsx` - Name, status, controls
- `src/components/session/ConversationView.tsx` - Messages, tool calls, thinking
- `src/components/session/MessageInput.tsx` - Send prompts to session

**Conversation rendering:**
- User messages with border-left blue
- Claude responses with border-left purple
- Collapsible `<details>` for thinking blocks
- Collapsible tool calls with syntax-highlighted output

**Send to session via tmux:**
```typescript
ipcMain.handle('send-to-session', (_, pane, text) => {
  execSync(`tmux send-keys -t ${pane} "${text}" Enter`);
});
```

### Phase 4: Right Sidebar - Context Panel
**Goal:** Ledger info, files, and actions

**Components:**
- `src/components/context/ActiveLedger.tsx` - Current ledger summary
- `src/components/context/FilesTouched.tsx` - Files modified in session
- `src/components/context/SessionActions.tsx` - Action buttons
- `src/components/context/RelatedSessions.tsx` - Cross-session awareness

**Files touched query:**
```sql
SELECT DISTINCT json_extract(content, '$.tool_name') as tool,
                json_extract(content, '$.file_path') as file
FROM events
WHERE session_id = ? AND json_extract(content, '$.file_path') IS NOT NULL;
```

### Phase 5: Ledger Modal + Management
**Goal:** View, edit, and manage ledgers

**Components:**
- `src/components/modals/LedgerViewer.tsx` - Full-screen ledger view
- `src/components/modals/LedgerEditor.tsx` - Edit ledger content

**Features:**
- Markdown rendering with syntax highlighting
- "Resume This" - spawn session with ledger context
- "Open in Session" - inject into current session
- Create new ledger from template

**IPC additions:**
```typescript
ipcMain.handle('write-ledger', (_, path, content) => writeLedger(path, content));
ipcMain.handle('create-ledger', (_, name, template) => createLedger(name, template));
```

### Phase 6: Session Actions
**Goal:** Full control over sessions

**Actions to implement:**
- **Resume from ledger**: Parse ledger, inject context, continue
- **Update ledger**: Extract current state, update file
- **Create handoff**: Generate handoff document
- **Split session**: Spawn new session, link to current

**IPC additions:**
```typescript
ipcMain.handle('resume-from-ledger', (_, sessionId, ledgerPath) => resumeFromLedger(sessionId, ledgerPath));
ipcMain.handle('update-ledger', (_, sessionId) => updateLedgerFromSession(sessionId));
ipcMain.handle('create-handoff', (_, sessionId) => createHandoff(sessionId));
ipcMain.handle('split-session', (_, sessionId, prompt) => splitSession(sessionId, prompt));
```

### Phase 7: Cross-Session Intelligence (Polish)
**Goal:** Awareness across all sessions

**Features:**
- File conflict detection (2+ sessions editing same file)
- Related sessions indicator
- Cross-session search

**Query for conflicts:**
```sql
SELECT file_path, GROUP_CONCAT(DISTINCT session_id) as sessions
FROM (
  SELECT session_id, json_extract(content, '$.file_path') as file_path
  FROM events
  WHERE json_extract(content, '$.tool_name') IN ('Edit', 'Write')
)
GROUP BY file_path
HAVING COUNT(DISTINCT session_id) > 1;
```

---

## v3 Files Summary

### Files to Modify

| File | Changes |
|------|---------|
| `electron/services/auto-detector.ts` | Fix persistence bug, genericize |
| `electron/main.ts` | Add IPC handlers for ledgers, send-to-session, actions |
| `electron/preload.cjs` | Expose new APIs |
| `src/App.tsx` | New 3-panel IDE layout |
| `src/index.css` | Dark theme CSS variables |

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/sidebar/SessionsList.tsx` | Active sessions list |
| `src/components/sidebar/LedgersBrowser.tsx` | Ledger navigation |
| `src/components/sidebar/QuickAccess.tsx` | Plans, Handoffs, Settings |
| `src/components/session/SessionHeader.tsx` | Session title bar |
| `src/components/session/ConversationView.tsx` | Chat history |
| `src/components/session/MessageInput.tsx` | Send to session |
| `src/components/context/ActiveLedger.tsx` | Ledger summary |
| `src/components/context/FilesTouched.tsx` | Files modified |
| `src/components/context/SessionActions.tsx` | Action buttons |
| `src/components/modals/LedgerViewer.tsx` | Ledger modal |
| `src/services/ledger-service.ts` | Ledger CRUD operations |

---

## Verification

### Development
```bash
cd ~/workspace/claude-session-manager
npm run dev          # Start Electron + Vite in dev mode
```

### v3 Manual Checks
- [ ] IDE layout renders correctly (3 panels)
- [ ] Sessions list shows all active sessions
- [ ] Click session → loads conversation
- [ ] Conversation shows messages, tool calls, thinking (collapsible)
- [ ] Ledgers browser shows all CONTINUITY_CLAUDE-*.md
- [ ] Click ledger → opens modal viewer
- [ ] Send message → injects into tmux session
- [ ] "Resume from ledger" works
- [ ] "Update ledger" syncs current state
- [ ] Files touched shows correct list
- [ ] Related sessions shows file conflicts

---

## Priority Order

1. **Phase 1: Foundation + Layout** - Fix bugs, new 3-panel structure
2. **Phase 2: Left Sidebar** - Sessions + Ledgers navigation
3. **Phase 3: Main Panel** - Conversation view + input (core value)
4. **Phase 4: Right Sidebar** - Context panel
5. **Phase 5: Ledger Modal** - View/edit ledgers
6. **Phase 6: Session Actions** - Resume, update, handoff, split
7. **Phase 7: Intelligence** - Cross-session awareness (polish)

---

## Technical Notes

### Working patterns to keep:
- Preload as native CommonJS (`electron/preload.cjs`)
- Electron 33 (not 40)
- Native module rebuild after version changes
- Streaming JSONL parser for large files
- FTS5 with LIKE fallback for search

### Known issues to fix:
- auto-detector.ts line 384: Not persisting detected values
- Area detection hardcoded to `areas/` pattern
- Preload copy log spam in vite plugin

### Mockup Reference
- `thoughts/shared/plans/claude-command-center-v3-embedded.html`

---

## Implementation Roadmap

### Sprint 1: Foundation (Phases 1-2)
**Scope:** Fix bugs + new layout + left sidebar

| Task | Est | Files |
|------|-----|-------|
| Fix auto-detector persistence | S | auto-detector.ts |
| Remove hardcoded area patterns | S | auto-detector.ts |
| Implement 3-panel layout | M | App.tsx, index.css |
| Create SessionsList component | M | sidebar/SessionsList.tsx |
| Create LedgersBrowser component | M | sidebar/LedgersBrowser.tsx |
| Add ledger IPC handlers | S | main.ts, preload.cjs |

**Verification:** App loads with 3-panel layout, sessions and ledgers visible

### Sprint 2: Core Value (Phases 3-4)
**Scope:** Session view + context panel - the core value prop

| Task | Est | Files |
|------|-----|-------|
| SessionHeader with controls | S | session/SessionHeader.tsx |
| ConversationView with collapsibles | L | session/ConversationView.tsx |
| MessageInput with send-to-tmux | M | session/MessageInput.tsx |
| ActiveLedger summary | S | context/ActiveLedger.tsx |
| FilesTouched list | S | context/FilesTouched.tsx |
| SessionActions buttons | S | context/SessionActions.tsx |

**Verification:** Can view full conversation, send messages to session

### Sprint 3: Ledger Management (Phases 5-6)
**Scope:** Full ledger workflow

| Task | Est | Files |
|------|-----|-------|
| LedgerViewer modal | M | modals/LedgerViewer.tsx |
| LedgerEditor with markdown | M | modals/LedgerEditor.tsx |
| Resume from ledger action | M | main.ts + service |
| Update ledger action | M | main.ts + service |
| Create handoff action | M | main.ts + service |
| Split session action | S | main.ts |

**Verification:** Can view/edit ledgers, resume from ledger works

### Sprint 4: Polish (Phase 7)
**Scope:** Cross-session intelligence + UX polish

| Task | Est | Files |
|------|-----|-------|
| File conflict detection | M | hooks/useFileConflicts.ts |
| Related sessions display | S | context/RelatedSessions.tsx |
| Cross-session search | M | services/search.ts |
| Keyboard shortcuts (⌘K) | S | App.tsx |
| Loading states | S | various |

**Verification:** Conflict warnings appear, search works across sessions

---

## Ledger Location

The continuity ledger for this project should be at:
```
~/workspace/claude-session-manager/thoughts/ledgers/CONTINUITY_CLAUDE-command-center-v3.md
```

Note: This is a NEW ledger for v3, separate from the v1 ledger.

### Ledger Content Template

```markdown
# Session: command-center-v3
Updated: 2026-01-25

## Goal
Transform Claude Session Manager v1 into an IDE-like command center with:
1. Embedded session interaction (send prompts to sessions)
2. Ledger management (browse, view, edit, link)
3. 3-panel IDE layout (sidebar + main + context)
4. Session actions (resume, handoff, split)

## Constraints
- Standalone app at `~/workspace/claude-session-manager/`
- Keep working: Electron 33, native CJS preload, better-sqlite3
- Dark theme consistent with v3 mockup

## Key Decisions
- IDE layout over tmux mirror (user feedback)
- Single session focus over multi-session grid
- Ledger management as first-class feature

## State
- Done:
  - [x] v1 complete and working
  - [x] v3 mockup created
  - [x] Plan approved
- Now: [ ] Sprint 1: Foundation
- Next:
  - [ ] Sprint 2: Core Value
  - [ ] Sprint 3: Ledger Management
  - [ ] Sprint 4: Polish

## Working Set
- Project: ~/workspace/claude-session-manager/
- Plan: thoughts/shared/plans/partitioned-stargazing-chipmunk.md
- Mockup: thoughts/shared/plans/claude-command-center-v3-embedded.html
```
